import type { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import {
  CANONICAL_EPOCH,
  CANONICAL_REQUIRED_PG_TRGM_VERSION,
} from './canonical-epoch'

const REPOSITORY_ROOT = resolve(__dirname, '..')
const EVIDENCE_DIRECTORY =
  '.omx/evidence/canonical-empty-db-perf-hardcutover'
const RECOVERY_DIRECTORY =
  '.omx/recovery/canonical-empty-db-perf-hardcutover'
const TARGET_OVERLAY_DIRECTORY =
  '.omx/overlays/canonical-empty-db-perf-hardcutover'
const RECOVERY_ARTIFACT_PATHS = {
  applicationArtifact: `${RECOVERY_DIRECTORY}/admin-api.zip`,
  backup: `${RECOVERY_DIRECTORY}/foo-before-gate-c.dump`,
  baselineSql:
    'db/migration/20260714004452_canonical_empty_db_baseline/migration.sql',
  candidateTree: `${RECOVERY_DIRECTORY}/candidate-tree.zip`,
  catalogGenerator: 'scripts/db-catalog-manifest.ts',
  catalogManifest:
    'db/migration/20260714004452_canonical_empty_db_baseline/catalog-manifest.json',
  clientArtifact: `${RECOVERY_DIRECTORY}/app-api.zip`,
  commentsSql: 'db/comments/generated.sql',
  configurationManifest: `${EVIDENCE_DIRECTORY}/configuration-manifest.json`,
  epochPolicy:
    'db/migration/20260714004452_canonical_empty_db_baseline/epoch-policy.json',
  finalArtifact: `${RECOVERY_DIRECTORY}/final-artifact.zip`,
  gateAEntry: `${EVIDENCE_DIRECTORY}/gate-a-entry-seal.json`,
  gateASeal: `${EVIDENCE_DIRECTORY}/gate-a-seal.json`,
  gateBA: `${EVIDENCE_DIRECTORY}/gate-b-a-seal.json`,
  gateBB: `${EVIDENCE_DIRECTORY}/gate-b-b-seal.json`,
  gateBSeal: `${EVIDENCE_DIRECTORY}/gate-b-seal.json`,
  generation: `${EVIDENCE_DIRECTORY}/generation-seal.json`,
  mergeSeal: `${EVIDENCE_DIRECTORY}/merge-seal.json`,
  mergedTree: `${RECOVERY_DIRECTORY}/merged-tree.zip`,
  migrationArtifact: `${RECOVERY_DIRECTORY}/migration-artifact.zip`,
  runbook: `${EVIDENCE_DIRECTORY}/recovery-runbook.md`,
  snapshot:
    'db/migration/20260714004452_canonical_empty_db_baseline/snapshot.json',
  targetOverlay: `${TARGET_OVERLAY_DIRECTORY}/target-registry.json`,
  validationCommands: `${EVIDENCE_DIRECTORY}/validation-commands.json`,
} as const
const RECOVERY_ARTIFACT_KEYS = Object.keys(
  RECOVERY_ARTIFACT_PATHS,
) as CanonicalRecoveryArtifactName[]
const VERIFIED_RECOVERY_EPOCH = Symbol('verified canonical recovery epoch')

/** 此 epoch 唯一允许读取的完整恢复包清单。 */
export const CANONICAL_RECOVERY_EPOCH_PATH = resolve(
  REPOSITORY_ROOT,
  EVIDENCE_DIRECTORY,
  'recovery-epoch.json',
)

export type CanonicalRecoveryArtifactName =
  keyof typeof RECOVERY_ARTIFACT_PATHS

/** 恢复包中的一个不可替换文件。 */
export interface CanonicalRecoveryArtifactBinding {
  bytes: number
  path: string
  sha256: string
}

/** 完整 epoch 恢复清单；不存在部分恢复格式。 */
export interface CanonicalRecoveryEpoch {
  artifacts: Record<
    CanonicalRecoveryArtifactName,
    CanonicalRecoveryArtifactBinding
  >
  epoch: typeof CANONICAL_EPOCH
  formatVersion: 1
  gitCommit: string
  partialOrMixedRollbackCount: 0
  requiredPgTrgmVersion: typeof CANONICAL_REQUIRED_PG_TRGM_VERSION
  status: 'complete'
  targetIdentityDigest: string
  targetRegistryDigest: string
}

/** Gate C 可消费的恢复包证明，仅能由验证函数产生。 */
export interface VerifiedCanonicalRecoveryEpoch {
  readonly [VERIFIED_RECOVERY_EPOCH]: true
  artifacts: CanonicalRecoveryEpoch['artifacts']
  backupDigest: string
  candidateDigest: string
  digest: string
  mergedArtifactDigest: string
  orderedGateDigests: CanonicalOrderedGateDigest[]
}

/** Gate C 必须按此顺序绑定的既有门禁。 */
export interface CanonicalOrderedGateDigest {
  digest: string
  name:
    | 'A-entry'
    | 'generation'
    | 'A-seal'
    | 'Gate-B-A'
    | 'Gate-B-B'
    | 'Gate-B'
    | 'merge'
}

/**
 * 重新读取并逐文件校验完整恢复包；摘要清单本身也由环境绑定。
 */
export function verifyCanonicalRecoveryEpoch(
  env: NodeJS.ProcessEnv,
  expectation: {
    targetIdentityDigest: string
    targetRegistryDigest: string
  },
): VerifiedCanonicalRecoveryEpoch {
  const expectedDigest = requireUpperSha256(
    env.CANONICAL_RECOVERY_EPOCH_SHA256,
    'CANONICAL_RECOVERY_EPOCH_SHA256',
  )
  const raw = readFileSync(CANONICAL_RECOVERY_EPOCH_PATH, 'utf8')
  const normalized = normalizeNewlines(raw)
  const digest = sha256Upper(normalized)
  if (digest !== expectedDigest) {
    throw new Error('Canonical recovery epoch 摘要不匹配')
  }

  let recovery: CanonicalRecoveryEpoch
  try {
    recovery = JSON.parse(normalized) as CanonicalRecoveryEpoch
  } catch {
    throw new Error('Canonical recovery epoch 不是有效 JSON')
  }
  assertRecoveryShape(recovery)
  if (`${JSON.stringify(recovery, null, 2)}\n` !== normalized) {
    throw new Error('Canonical recovery epoch 字节不是规范格式')
  }
  if (
    recovery.targetIdentityDigest !== expectation.targetIdentityDigest ||
    recovery.targetRegistryDigest !== expectation.targetRegistryDigest
  ) {
    throw new Error('Canonical recovery epoch 目标绑定不匹配')
  }
  assertCurrentGitCommit(recovery.gitCommit)
  for (const name of RECOVERY_ARTIFACT_KEYS) {
    verifyArtifact(name, recovery.artifacts[name])
  }

  return {
    [VERIFIED_RECOVERY_EPOCH]: true,
    artifacts: recovery.artifacts,
    backupDigest: recovery.artifacts.backup.sha256,
    candidateDigest: recovery.artifacts.candidateTree.sha256,
    digest,
    mergedArtifactDigest: recovery.artifacts.mergedTree.sha256,
    orderedGateDigests: [
      gateDigest('A-entry', recovery.artifacts.gateAEntry),
      gateDigest('generation', recovery.artifacts.generation),
      gateDigest('A-seal', recovery.artifacts.gateASeal),
      gateDigest('Gate-B-A', recovery.artifacts.gateBA),
      gateDigest('Gate-B-B', recovery.artifacts.gateBB),
      gateDigest('Gate-B', recovery.artifacts.gateBSeal),
      gateDigest('merge', recovery.artifacts.mergeSeal),
    ],
  }
}

function assertRecoveryShape(
  value: CanonicalRecoveryEpoch,
): asserts value is CanonicalRecoveryEpoch {
  if (!isRecord(value)) {
    throw new Error('Canonical recovery epoch 配置无效')
  }
  assertExactKeys(
    value,
    [
      'artifacts',
      'epoch',
      'formatVersion',
      'gitCommit',
      'partialOrMixedRollbackCount',
      'requiredPgTrgmVersion',
      'status',
      'targetIdentityDigest',
      'targetRegistryDigest',
    ],
    'Canonical recovery epoch',
  )
  if (
    value.formatVersion !== 1 ||
    value.status !== 'complete' ||
    value.epoch !== CANONICAL_EPOCH ||
    value.requiredPgTrgmVersion !== CANONICAL_REQUIRED_PG_TRGM_VERSION ||
    value.partialOrMixedRollbackCount !== 0 ||
    !/^[a-f0-9]{40}$/u.test(value.gitCommit) ||
    !isUpperSha256(value.targetIdentityDigest) ||
    !isUpperSha256(value.targetRegistryDigest) ||
    !isRecord(value.artifacts)
  ) {
    throw new Error('Canonical recovery epoch 契约无效')
  }
  assertExactKeys(
    value.artifacts,
    RECOVERY_ARTIFACT_KEYS,
    'Canonical recovery artifacts',
  )
  for (const name of RECOVERY_ARTIFACT_KEYS) {
    assertArtifactShape(name, value.artifacts[name])
  }
}

function assertArtifactShape(
  name: CanonicalRecoveryArtifactName,
  value: CanonicalRecoveryArtifactBinding,
) {
  if (!isRecord(value)) {
    throw new Error(`Canonical recovery artifact 配置无效：${name}`)
  }
  assertExactKeys(value, ['bytes', 'path', 'sha256'], `Artifact ${name}`)
  if (
    value.path !== RECOVERY_ARTIFACT_PATHS[name] ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes < 0 ||
    !isUpperSha256(value.sha256)
  ) {
    throw new Error(`Canonical recovery artifact 契约无效：${name}`)
  }
}

function verifyArtifact(
  name: CanonicalRecoveryArtifactName,
  binding: CanonicalRecoveryArtifactBinding,
) {
  const path = resolveArtifactPath(binding.path)
  const stats = statSync(path)
  if (!stats.isFile() || stats.size !== binding.bytes) {
    throw new Error(`Canonical recovery artifact 文件或长度不匹配：${name}`)
  }
  const digest = sha256Upper(readFileSync(path))
  if (digest !== binding.sha256) {
    throw new Error(`Canonical recovery artifact 摘要不匹配：${name}`)
  }
}

function resolveArtifactPath(path: string) {
  if (isAbsolute(path) || path.includes('\\')) {
    throw new Error('Canonical recovery artifact 必须使用仓库内 POSIX 相对路径')
  }
  const absolute = resolve(REPOSITORY_ROOT, path)
  const relativePath = relative(REPOSITORY_ROOT, absolute)
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`)
  ) {
    throw new Error('Canonical recovery artifact 越出仓库边界')
  }
  return absolute
}

function assertCurrentGitCommit(expected: string) {
  const actual = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    windowsHide: true,
  }).trim()
  if (actual !== expected) {
    throw new Error('Canonical recovery epoch Git commit 不匹配')
  }
}

function gateDigest(
  name: CanonicalOrderedGateDigest['name'],
  artifact: CanonicalRecoveryArtifactBinding,
): CanonicalOrderedGateDigest {
  return { digest: artifact.sha256, name }
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

function isUpperSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[A-F0-9]{64}$/u.test(value)
}

function normalizeNewlines(value: string) {
  return value.replace(/\r\n/gu, '\n')
}

function sha256Upper(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
