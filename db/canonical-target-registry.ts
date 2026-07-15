import type { CanonicalTargetIdentity } from './canonical-epoch'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CANONICAL_EPOCH,
  CANONICAL_REQUIRED_PG_TRGM_VERSION,
  CANONICAL_REQUIRED_POSTGRESQL_VERSION,
} from './canonical-epoch'

const TARGET_NAMES = ['A', 'B', 'C', 'generation'] as const
const TARGET_DATABASES = {
  A: 'foo_gate_b_a',
  B: 'foo_gate_b_b',
  C: 'foo',
  generation: 'foo_generation',
} as const
const TARGET_KINDS = {
  A: 'gate-b',
  B: 'gate-b',
  C: 'gate-c',
  generation: 'generation',
} as const
const TARGET_ISOLATION = {
  A: ['B'],
  B: ['A'],
  C: [],
  generation: [],
} as const
const REPOSITORY_ROOT = resolve(__dirname, '..')

/** 此 epoch 唯一允许读取的目标注册表。 */
export const CANONICAL_TARGET_REGISTRY_PATH = resolve(
  REPOSITORY_ROOT,
  '.omx',
  'overlays',
  'canonical-empty-db-perf-hardcutover',
  'target-registry.json',
)

export type CanonicalTargetName = (typeof TARGET_NAMES)[number]

/** 注册表冻结的、可在目标间比较的数据库能力。 */
export interface CanonicalRegisteredTarget {
  capabilityDigest: string
  database: string
  databaseCollation: string
  databaseCreatePrivilege: true
  databaseCtype: string
  databaseLocale: string
  databaseOid: string
  disposable: true
  isolatedFrom: CanonicalTargetName[]
  kind: 'gate-b' | 'gate-c' | 'generation'
  localeProvider: string
  migrationRoleOid: string
  pgTrgmAvailable: true
  production: false
  publicSchemaCreatePrivilege: true
  redactedIdentityDigest: string
  registered: true
  requiredPgTrgmVersion: typeof CANONICAL_REQUIRED_PG_TRGM_VERSION
  resetAuthority: true
  serverEncoding: 'UTF8'
  serverVersion: typeof CANONICAL_REQUIRED_POSTGRESQL_VERSION
  shared: false
}

/** 目标注册表的唯一当前格式。 */
export interface CanonicalTargetRegistry {
  epoch: typeof CANONICAL_EPOCH
  formatVersion: 2
  requiredPgTrgmVersion: typeof CANONICAL_REQUIRED_PG_TRGM_VERSION
  requiredPostgreSqlVersion: typeof CANONICAL_REQUIRED_POSTGRESQL_VERSION
  status: 'registered'
  targets: Record<CanonicalTargetName, CanonicalRegisteredTarget>
}

/** 已校验原始字节摘要的注册表。 */
export interface CanonicalTargetRegistryArtifact {
  digest: string
  registry: CanonicalTargetRegistry
}

/** 唯一匹配当前连接的注册项。 */
export interface CanonicalTargetRegistration {
  name: CanonicalTargetName
  registryDigest: string
  target: CanonicalRegisteredTarget
}

/**
 * 从固定路径读取注册表，并要求调用者绑定其准确字节摘要。
 */
export function readCanonicalTargetRegistry(
  env: NodeJS.ProcessEnv,
): CanonicalTargetRegistryArtifact {
  const expectedDigest = requireUpperSha256(
    env.CANONICAL_TARGET_REGISTRY_SHA256,
    'CANONICAL_TARGET_REGISTRY_SHA256',
  )
  const raw = readFileSync(CANONICAL_TARGET_REGISTRY_PATH, 'utf8')
  const normalized = normalizeNewlines(raw)
  const actualDigest = sha256Upper(normalized)
  if (actualDigest !== expectedDigest) {
    throw new Error('Canonical target registry 摘要不匹配')
  }

  let parsed: CanonicalTargetRegistry
  try {
    parsed = JSON.parse(normalized) as CanonicalTargetRegistry
  } catch {
    throw new Error('Canonical target registry 不是有效 JSON')
  }
  assertRegistryShape(parsed)
  if (`${JSON.stringify(parsed, null, 2)}\n` !== normalized) {
    throw new Error('Canonical target registry 字节不是规范格式')
  }
  assertRegistryClosure(parsed)
  return { digest: actualDigest, registry: parsed }
}

/**
 * 以完整身份和能力元组进行唯一匹配；不采用顺序或首个命中语义。
 */
export function assertRegisteredCanonicalTarget(
  identity: CanonicalTargetIdentity,
  artifact: CanonicalTargetRegistryArtifact,
): CanonicalTargetRegistration {
  const matches = TARGET_NAMES.filter(
    (name) =>
      artifact.registry.targets[name].redactedIdentityDigest ===
      identity.fingerprint,
  )
  if (matches.length !== 1) {
    throw new Error('Canonical target 身份必须且只能匹配一个注册目标')
  }

  const name = matches[0]
  const target = artifact.registry.targets[name]
  if (!name || !target || !sameTargetIdentity(target, identity)) {
    throw new Error('Canonical target registry 身份或能力覆盖不匹配')
  }
  return { name, registryDigest: artifact.digest, target }
}

function assertRegistryShape(
  value: CanonicalTargetRegistry,
): asserts value is CanonicalTargetRegistry {
  if (!isRecord(value)) {
    throw new Error('Canonical target registry 配置无效')
  }
  assertExactKeys(
    value,
    [
      'epoch',
      'formatVersion',
      'requiredPgTrgmVersion',
      'requiredPostgreSqlVersion',
      'status',
      'targets',
    ],
    'Canonical target registry',
  )
  if (
    value.formatVersion !== 2 ||
    value.status !== 'registered' ||
    value.epoch !== CANONICAL_EPOCH ||
    value.requiredPostgreSqlVersion !==
      CANONICAL_REQUIRED_POSTGRESQL_VERSION ||
    value.requiredPgTrgmVersion !== CANONICAL_REQUIRED_PG_TRGM_VERSION ||
    !isRecord(value.targets)
  ) {
    throw new Error('Canonical target registry 契约无效')
  }
  const actualNames = Object.keys(value.targets).sort()
  const expectedNames = [...TARGET_NAMES].sort()
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error('Canonical target registry 目标集合无效')
  }
  for (const name of TARGET_NAMES) {
    assertRegisteredTargetShape(value.targets[name], name)
  }
}

function assertRegisteredTargetShape(
  value: unknown,
  name: CanonicalTargetName,
): asserts value is CanonicalRegisteredTarget {
  if (!isRecord(value)) {
    throw new Error(`Canonical target ${name} 配置无效`)
  }
  assertExactKeys(
    value,
    [
      'capabilityDigest',
      'database',
      'databaseCollation',
      'databaseCreatePrivilege',
      'databaseCtype',
      'databaseLocale',
      'databaseOid',
      'disposable',
      'isolatedFrom',
      'kind',
      'localeProvider',
      'migrationRoleOid',
      'pgTrgmAvailable',
      'production',
      'publicSchemaCreatePrivilege',
      'redactedIdentityDigest',
      'registered',
      'requiredPgTrgmVersion',
      'resetAuthority',
      'serverEncoding',
      'serverVersion',
      'shared',
    ],
    `Canonical target ${name}`,
  )
  if (
    value.registered !== true ||
    value.disposable !== true ||
    value.production !== false ||
    value.shared !== false ||
    value.databaseCreatePrivilege !== true ||
    value.publicSchemaCreatePrivilege !== true ||
    value.pgTrgmAvailable !== true ||
    value.resetAuthority !== true ||
    value.database !== TARGET_DATABASES[name] ||
    value.kind !== TARGET_KINDS[name] ||
    value.serverVersion !== CANONICAL_REQUIRED_POSTGRESQL_VERSION ||
    value.serverEncoding !== 'UTF8' ||
    value.requiredPgTrgmVersion !== CANONICAL_REQUIRED_PG_TRGM_VERSION ||
    typeof value.databaseCollation !== 'string' ||
    value.databaseCollation.length === 0 ||
    typeof value.databaseCtype !== 'string' ||
    value.databaseCtype.length === 0 ||
    typeof value.databaseLocale !== 'string' ||
    typeof value.localeProvider !== 'string' ||
    value.localeProvider.length !== 1 ||
    typeof value.databaseOid !== 'string' ||
    !/^\d+$/u.test(value.databaseOid) ||
    typeof value.migrationRoleOid !== 'string' ||
    !/^\d+$/u.test(value.migrationRoleOid) ||
    !isUpperSha256(value.capabilityDigest) ||
    !isUpperSha256(value.redactedIdentityDigest) ||
    !Array.isArray(value.isolatedFrom) ||
    JSON.stringify(value.isolatedFrom) !==
      JSON.stringify(TARGET_ISOLATION[name])
  ) {
    throw new Error(`Canonical target ${name} 不是封闭的 disposable 目标`)
  }
}

function assertRegistryClosure(registry: CanonicalTargetRegistry) {
  const identities = TARGET_NAMES.map(
    (name) => registry.targets[name].redactedIdentityDigest,
  )
  if (new Set(identities).size !== TARGET_NAMES.length) {
    throw new Error('Canonical target registry 含重复身份')
  }
  const databases = TARGET_NAMES.map(
    (name) => registry.targets[name].database,
  )
  if (new Set(databases).size !== TARGET_NAMES.length) {
    throw new Error('Canonical target registry 含重复数据库')
  }
  const capabilityDigests = TARGET_NAMES.map(
    (name) => registry.targets[name].capabilityDigest,
  )
  if (new Set(capabilityDigests).size !== 1) {
    throw new Error('Canonical target registry 的四目标能力元组不一致')
  }
}

function sameTargetIdentity(
  target: CanonicalRegisteredTarget,
  identity: CanonicalTargetIdentity,
) {
  return (
    target.redactedIdentityDigest === identity.fingerprint &&
    target.capabilityDigest === identity.capabilityDigest &&
    target.database === identity.databaseName &&
    target.databaseOid === identity.databaseOid &&
    target.migrationRoleOid === identity.roleOid &&
    target.serverVersion === identity.serverVersion &&
    target.serverEncoding === identity.serverEncoding &&
    target.databaseCollation === identity.databaseCollation &&
    target.databaseCtype === identity.databaseCtype &&
    target.localeProvider === identity.localeProvider &&
    target.databaseLocale === identity.databaseLocale &&
    target.databaseCreatePrivilege === identity.databaseCreatePrivilege &&
    target.publicSchemaCreatePrivilege ===
      identity.publicSchemaCreatePrivilege &&
    target.pgTrgmAvailable === identity.pgTrgmAvailable &&
    target.resetAuthority === identity.resetAuthority
  )
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

function sha256Upper(value: string) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
