const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'y'])
const PRODUCTION_ENV_NAMES = new Set(['prod', 'production'])
const DEFAULT_DEMO_SEED_DENY_TOKENS = ['prod', 'production']

export interface DatabaseConnection {
  databaseUrl: string
  protocol: string
  hostname: string
  databaseName: string
  username: string
  safeLabel: string
}

export interface CanonicalMigrationConnection extends DatabaseConnection {
  disposableAuthorization: string
  epoch: string
  initializeAuthorization?: string
  targetFingerprint: string
}

interface DemoSeedEnvironment extends DatabaseConnection {
  nodeEnv: string
}

export interface ReferenceBootstrapAdmin {
  username: string
  password: string
  mobile?: string
  avatar?: string
}

export interface ReferenceBootstrapOptions {
  admin?: ReferenceBootstrapAdmin
}

export function shouldCheckDatabaseToolEnvironmentOnly(argv: string[]) {
  return argv.includes('--check-env') || argv.includes('--dry-run')
}

export function assertSafeDemoSeedEnvironment(
  env: NodeJS.ProcessEnv,
): DemoSeedEnvironment {
  const nodeEnv = normalizeEnvValue(env.NODE_ENV) || 'development'

  if (PRODUCTION_ENV_NAMES.has(nodeEnv)) {
    throw new Error('Demo seed 禁止在 NODE_ENV=production/prod 下运行')
  }

  if (!isTruthyEnv(env.ALLOW_DB_SEED)) {
    throw new Error('Demo seed 必须显式设置 ALLOW_DB_SEED=true')
  }

  const database = readDatabaseConnection(env, 'Demo seed 需要 DATABASE_URL')
  const matchedDenyToken = findMatchedDenyToken(
    database,
    readListEnv(env.DB_SEED_DENYLIST_TOKENS, DEFAULT_DEMO_SEED_DENY_TOKENS),
  )

  if (matchedDenyToken) {
    throw new Error(`Demo seed 目标库命中生产危险关键字: ${matchedDenyToken}`)
  }

  return {
    ...database,
    nodeEnv,
  }
}

export function readDatabaseConnection(
  env: NodeJS.ProcessEnv,
  missingUrlMessage: string,
): DatabaseConnection {
  return parseDatabaseConnection(
    requireEnv(env, 'DATABASE_URL', missingUrlMessage),
  )
}

/**
 * 读取 canonical epoch 的显式目标授权。
 *
 * 这些值只用于绑定本次连接的目标身份和 epoch，不进入日志、清单或错误信息。
 */
export function readCanonicalMigrationAuthorization(
  env: NodeJS.ProcessEnv,
  missingUrlMessage: string,
): CanonicalMigrationConnection {
  const database = readDatabaseConnection(env, missingUrlMessage)
  const epoch = requireEnv(
    env,
    'CANONICAL_MIGRATION_EPOCH',
    '缺少 CANONICAL_MIGRATION_EPOCH',
  )
  const targetFingerprint = requireUpperSha256Env(
    env,
    'CANONICAL_TARGET_FINGERPRINT',
  )
  const disposableAuthorization = requireLowerSha256Env(
    env,
    'CANONICAL_DISPOSABLE_AUTHORIZATION',
  )
  const initializeAuthorization = optionalLowerSha256Env(
    env,
    'CANONICAL_INITIALIZE_AUTHORIZATION',
  )

  return {
    ...database,
    disposableAuthorization,
    epoch,
    ...(initializeAuthorization ? { initializeAuthorization } : {}),
    targetFingerprint,
  }
}

export function readReferenceBootstrapOptions(
  env: NodeJS.ProcessEnv,
): ReferenceBootstrapOptions {
  const username = normalizeEnvValue(env.BOOTSTRAP_ADMIN_USERNAME)
  const password = normalizeEnvValue(env.BOOTSTRAP_ADMIN_PASSWORD)

  if ((username && !password) || (!username && password)) {
    throw new Error(
      'BOOTSTRAP_ADMIN_USERNAME 与 BOOTSTRAP_ADMIN_PASSWORD 必须同时设置或同时省略',
    )
  }

  if (!username || !password) {
    return {}
  }

  if (username.length > 20) {
    throw new Error('BOOTSTRAP_ADMIN_USERNAME 长度不能超过 20')
  }

  if (password.length < 8) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD 长度至少为 8')
  }

  const mobile = normalizeEnvValue(env.BOOTSTRAP_ADMIN_MOBILE)
  const avatar = normalizeEnvValue(env.BOOTSTRAP_ADMIN_AVATAR)

  if (mobile && mobile.length > 11) {
    throw new Error('BOOTSTRAP_ADMIN_MOBILE 长度不能超过 11')
  }

  if (avatar && avatar.length > 200) {
    throw new Error('BOOTSTRAP_ADMIN_AVATAR 长度不能超过 200')
  }

  return {
    admin: {
      username,
      password,
      ...(mobile ? { mobile } : {}),
      ...(avatar ? { avatar } : {}),
    },
  }
}

function requireEnv(env: NodeJS.ProcessEnv, key: string, message: string) {
  const value = normalizeEnvValue(env[key])

  if (!value) {
    throw new Error(message)
  }

  return value
}

function requireUpperSha256Env(env: NodeJS.ProcessEnv, key: string) {
  const value = requireEnv(env, key, `缺少 ${key}`)
  if (!/^[A-F0-9]{64}$/u.test(value)) {
    throw new Error(`${key} 必须是 64 位大写 SHA-256`)
  }
  return value
}

function requireLowerSha256Env(env: NodeJS.ProcessEnv, key: string) {
  const value = requireEnv(env, key, `缺少 ${key}`)
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`${key} 必须是 64 位小写 SHA-256`)
  }
  return value
}

function optionalLowerSha256Env(env: NodeJS.ProcessEnv, key: string) {
  const value = normalizeEnvValue(env[key])
  if (!value) {
    return undefined
  }
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`${key} 必须是 64 位小写 SHA-256`)
  }
  return value
}

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

function isTruthyEnv(value: string | undefined) {
  const normalized = normalizeEnvValue(value)?.toLowerCase()
  return Boolean(normalized && TRUE_ENV_VALUES.has(normalized))
}

function readListEnv(value: string | undefined, defaults: string[]) {
  const items = [...defaults, ...(value ?? '').split(',')]

  return Array.from(
    new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean)),
  )
}

function parseDatabaseConnection(databaseUrl: string): DatabaseConnection {
  let url: URL

  try {
    url = new URL(databaseUrl)
  } catch (error) {
    throw new Error(`DATABASE_URL 不是合法 URL: ${String(error)}`)
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''))

  if (!databaseName) {
    throw new Error('DATABASE_URL 必须包含数据库名')
  }

  return {
    databaseUrl,
    protocol: url.protocol.replace(/:$/, ''),
    hostname: url.hostname.toLowerCase(),
    databaseName,
    username: decodeURIComponent(url.username),
    safeLabel: formatSafeDatabaseLabel(url, databaseName),
  }
}

function formatSafeDatabaseLabel(url: URL, databaseName: string) {
  const port = url.port ? `:${url.port}` : ''

  return `${url.protocol}//${url.hostname}${port}/${databaseName}`
}

function findMatchedDenyToken(
  database: DatabaseConnection,
  denyTokens: string[],
) {
  const haystack = [database.hostname, database.databaseName, database.username]
    .join('/')
    .toLowerCase()

  return denyTokens.find((token) => haystack.includes(token))
}
