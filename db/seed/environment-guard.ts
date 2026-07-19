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

interface DemoSeedEnvironment extends DatabaseConnection {
  nodeEnv: string
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

function requireEnv(env: NodeJS.ProcessEnv, key: string, message: string) {
  const value = normalizeEnvValue(env[key])

  if (!value) {
    throw new Error(message)
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
