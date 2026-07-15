import type { CanonicalTargetIdentity } from './canonical-epoch'
import type {
  CanonicalOrderedGateDigest,
  VerifiedCanonicalRecoveryEpoch,
} from './canonical-recovery-epoch'
import type { CanonicalTargetRegistration } from './canonical-target-registry'
import { Buffer } from 'node:buffer'
import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto'
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { CANONICAL_EPOCH } from './canonical-epoch'

const REPOSITORY_ROOT = resolve(__dirname, '..')
const GATE_C_EVIDENCE_DIRECTORY = resolve(
  REPOSITORY_ROOT,
  '.omx',
  'evidence',
  'canonical-empty-db-perf-hardcutover',
)
const GATE_C_CONSUMPTION_DIRECTORY = resolve(
  GATE_C_EVIDENCE_DIRECTORY,
  'gate-c-consumption',
)
const MAX_SESSION_LIFETIME_MS = 15 * 60 * 1000
const ORDERED_GATE_NAMES = [
  'A-entry',
  'generation',
  'A-seal',
  'Gate-B-A',
  'Gate-B-B',
  'Gate-B',
  'merge',
] as const

/** 此 epoch 唯一允许消费的 Gate C 授权文件。 */
export const CANONICAL_GATE_C_SESSION_PATH = resolve(
  GATE_C_EVIDENCE_DIRECTORY,
  'gate-c-session.json',
)

interface GateCSessionPayload {
  backupDigest: string
  candidateDigest: string
  epoch: typeof CANONICAL_EPOCH
  expiresAt: string
  formatVersion: 2
  issuedAt: string
  mergedArtifactDigest: string
  nonceDigest: string
  oneUse: true
  operatorDigest: string
  orderedGateDigests: CanonicalOrderedGateDigest[]
  recoveryEpochDigest: string
  status: 'issued'
  targetIdentityDigest: string
  targetName: 'C'
  targetRegistryDigest: string
}

interface GateCSessionEvidence extends GateCSessionPayload {
  authorizationDigest: string
  sessionDigest: string
}

/**
 * 验证外部一次性 nonce、完整门禁链和恢复包后，原子消费 Gate C 授权。
 */
export function consumeCanonicalGateCMigrationSession(
  env: NodeJS.ProcessEnv,
  identity: CanonicalTargetIdentity,
  registration: CanonicalTargetRegistration,
  recovery: VerifiedCanonicalRecoveryEpoch,
) {
  if (registration.name !== 'C') {
    throw new Error('Gate C 授权只能用于注册目标 C')
  }
  const expectedFileDigest = requireUpperSha256(
    env.CANONICAL_GATE_C_SESSION_SHA256,
    'CANONICAL_GATE_C_SESSION_SHA256',
  )
  const nonce = requireNonce(env.CANONICAL_GATE_C_NONCE)
  const raw = readFileSync(CANONICAL_GATE_C_SESSION_PATH, 'utf8')
  const normalized = normalizeNewlines(raw)
  if (sha256Upper(normalized) !== expectedFileDigest) {
    throw new Error('Gate C 会话文件摘要不匹配')
  }

  let evidence: GateCSessionEvidence
  try {
    evidence = JSON.parse(normalized) as GateCSessionEvidence
  } catch {
    throw new Error('Gate C 会话授权不是有效 JSON')
  }
  assertSessionShape(evidence)
  if (`${JSON.stringify(evidence, null, 2)}\n` !== normalized) {
    throw new Error('Gate C 会话授权字节不是规范格式')
  }
  assertSessionBindings(evidence, identity, registration, recovery)
  assertSessionTimeWindow(evidence)
  assertNonceAuthorization(evidence, nonce)
  consumeSession(evidence)
  return evidence.sessionDigest
}

function assertSessionShape(
  evidence: GateCSessionEvidence,
): asserts evidence is GateCSessionEvidence {
  if (!isRecord(evidence)) {
    throw new Error('Gate C 会话授权格式无效')
  }
  assertExactKeys(
    evidence,
    [
      'authorizationDigest',
      'backupDigest',
      'candidateDigest',
      'epoch',
      'expiresAt',
      'formatVersion',
      'issuedAt',
      'mergedArtifactDigest',
      'nonceDigest',
      'oneUse',
      'operatorDigest',
      'orderedGateDigests',
      'recoveryEpochDigest',
      'sessionDigest',
      'status',
      'targetIdentityDigest',
      'targetName',
      'targetRegistryDigest',
    ],
    'Gate C session',
  )
  if (
    evidence.formatVersion !== 2 ||
    evidence.status !== 'issued' ||
    evidence.oneUse !== true ||
    evidence.targetName !== 'C' ||
    evidence.epoch !== CANONICAL_EPOCH ||
    !isUpperSha256(evidence.targetIdentityDigest) ||
    !isUpperSha256(evidence.targetRegistryDigest) ||
    !isUpperSha256(evidence.candidateDigest) ||
    !isUpperSha256(evidence.mergedArtifactDigest) ||
    !isUpperSha256(evidence.operatorDigest) ||
    !isUpperSha256(evidence.recoveryEpochDigest) ||
    !isUpperSha256(evidence.backupDigest) ||
    !isUpperSha256(evidence.nonceDigest) ||
    !isUpperSha256(evidence.authorizationDigest) ||
    !isUpperSha256(evidence.sessionDigest) ||
    typeof evidence.issuedAt !== 'string' ||
    typeof evidence.expiresAt !== 'string' ||
    !Array.isArray(evidence.orderedGateDigests) ||
    evidence.orderedGateDigests.length !== ORDERED_GATE_NAMES.length
  ) {
    throw new Error('Gate C 会话授权格式无效')
  }
  evidence.orderedGateDigests.forEach((gate, index) => {
    if (!isRecord(gate)) {
      throw new Error('Gate C 门禁链格式无效')
    }
    assertExactKeys(gate, ['digest', 'name'], 'Gate C ordered gate')
    if (
      gate.name !== ORDERED_GATE_NAMES[index] ||
      !isUpperSha256(gate.digest)
    ) {
      throw new Error('Gate C 门禁链顺序或摘要无效')
    }
  })
}

function assertSessionBindings(
  evidence: GateCSessionEvidence,
  identity: CanonicalTargetIdentity,
  registration: CanonicalTargetRegistration,
  recovery: VerifiedCanonicalRecoveryEpoch,
) {
  if (
    evidence.targetIdentityDigest !== identity.fingerprint ||
    evidence.targetRegistryDigest !== registration.registryDigest ||
    evidence.recoveryEpochDigest !== recovery.digest ||
    evidence.backupDigest !== recovery.backupDigest ||
    evidence.candidateDigest !== recovery.candidateDigest ||
    evidence.mergedArtifactDigest !== recovery.mergedArtifactDigest ||
    JSON.stringify(evidence.orderedGateDigests) !==
      JSON.stringify(recovery.orderedGateDigests)
  ) {
    throw new Error('Gate C 会话与目标、门禁链或完整恢复包不匹配')
  }
}

function assertSessionTimeWindow(evidence: GateCSessionEvidence) {
  const issuedAt = Date.parse(evidence.issuedAt)
  const expiresAt = Date.parse(evidence.expiresAt)
  const now = Date.now()
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    issuedAt > now ||
    expiresAt <= now ||
    issuedAt >= expiresAt ||
    expiresAt - issuedAt > MAX_SESSION_LIFETIME_MS
  ) {
    throw new Error('Gate C 会话已过期或时间边界无效')
  }
}

function assertNonceAuthorization(
  evidence: GateCSessionEvidence,
  nonce: string,
) {
  const actualNonceDigest = sha256Upper(nonce)
  if (!equalHex(evidence.nonceDigest, actualNonceDigest)) {
    throw new Error('Gate C 外部 nonce 不匹配')
  }
  const payload = toPayload(evidence)
  const expectedAuthorizationDigest = createHmac('sha256', nonce)
    .update(JSON.stringify(payload))
    .digest('hex')
    .toUpperCase()
  if (!equalHex(evidence.authorizationDigest, expectedAuthorizationDigest)) {
    throw new Error('Gate C 外部 nonce 授权摘要不匹配')
  }
  const expectedSessionDigest = sha256Upper(
    JSON.stringify({
      ...payload,
      authorizationDigest: evidence.authorizationDigest,
    }),
  )
  if (!equalHex(evidence.sessionDigest, expectedSessionDigest)) {
    throw new Error('Gate C 会话摘要不匹配')
  }
}

function consumeSession(evidence: GateCSessionEvidence) {
  mkdirSync(GATE_C_CONSUMPTION_DIRECTORY, { mode: 0o700, recursive: true })
  const usagePath = resolve(
    GATE_C_CONSUMPTION_DIRECTORY,
    `${evidence.sessionDigest}.json`,
  )
  let fileDescriptor: number | undefined
  try {
    fileDescriptor = openSync(usagePath, 'wx', 0o600)
    writeFileSync(
      fileDescriptor,
      `${JSON.stringify({
        nonceDigest: evidence.nonceDigest,
        sessionDigest: evidence.sessionDigest,
        status: 'migration-consumed',
        usedAt: new Date().toISOString(),
      })}\n`,
      'utf8',
    )
    fsyncSync(fileDescriptor)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('Gate C migration 会话已使用')
    }
    throw error
  } finally {
    if (fileDescriptor !== undefined) {
      closeSync(fileDescriptor)
    }
  }
}

function toPayload(evidence: GateCSessionEvidence): GateCSessionPayload {
  return {
    backupDigest: evidence.backupDigest,
    candidateDigest: evidence.candidateDigest,
    epoch: evidence.epoch,
    expiresAt: evidence.expiresAt,
    formatVersion: evidence.formatVersion,
    issuedAt: evidence.issuedAt,
    mergedArtifactDigest: evidence.mergedArtifactDigest,
    nonceDigest: evidence.nonceDigest,
    oneUse: evidence.oneUse,
    operatorDigest: evidence.operatorDigest,
    orderedGateDigests: evidence.orderedGateDigests,
    recoveryEpochDigest: evidence.recoveryEpochDigest,
    status: evidence.status,
    targetIdentityDigest: evidence.targetIdentityDigest,
    targetName: evidence.targetName,
    targetRegistryDigest: evidence.targetRegistryDigest,
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: string[],
  label: string,
) {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) {
    throw new Error(`${label} 字段集合无效`)
  }
}

function requireUpperSha256(value: string | undefined, name: string) {
  const normalized = value?.trim()
  if (!normalized || !isUpperSha256(normalized)) {
    throw new Error(`缺少或无效的 ${name}`)
  }
  return normalized
}

function requireNonce(value: string | undefined) {
  const normalized = value?.trim()
  if (!normalized || !/^[\w-]{43}$/u.test(normalized)) {
    throw new Error('缺少或无效的 CANONICAL_GATE_C_NONCE')
  }
  return normalized
}

function equalHex(left: string, right: string) {
  const leftBytes = Buffer.from(left, 'hex')
  const rightBytes = Buffer.from(right, 'hex')
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  )
}

function isUpperSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[A-F0-9]{64}$/u.test(value)
}

function normalizeNewlines(value: string) {
  return value.replace(/\r\n/gu, '\n')
}

function sha256Upper(value: string) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
