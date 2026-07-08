const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'y'])
const PRODUCTION_ENV_NAMES = new Set(['prod', 'production'])
const DEFAULT_DEMO_SEED_DENY_TOKENS = ['prod', 'production']

interface DatabaseTarget {
  databaseUrl: string
  protocol: string
  hostname: string
  databaseName: string
  username: string
  safeLabel: string
}

interface DemoSeedEnvironment extends DatabaseTarget {
  nodeEnv: string
}

interface ReferenceBootstrapAdmin {
  username: string
  password: string
  mobile?: string
  avatar?: string
}

interface ReferenceBootstrapEnvironment extends DatabaseTarget {
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

  const target = parseDatabaseTarget(
    requireEnv(env, 'DATABASE_URL', 'Demo seed 需要 DATABASE_URL'),
  )
  const matchedDenyToken = findMatchedDenyToken(
    target,
    readListEnv(env.DB_SEED_DENYLIST_TOKENS, DEFAULT_DEMO_SEED_DENY_TOKENS),
  )

  if (matchedDenyToken) {
    throw new Error(`Demo seed 目标库命中生产危险关键字: ${matchedDenyToken}`)
  }

  return {
    ...target,
    nodeEnv,
  }
}

export function assertReferenceBootstrapEnvironment(
  env: NodeJS.ProcessEnv,
): ReferenceBootstrapEnvironment {
  const target = parseDatabaseTarget(
    requireEnv(env, 'DATABASE_URL', 'Reference bootstrap 需要 DATABASE_URL'),
  )
  const username = normalizeEnvValue(env.BOOTSTRAP_ADMIN_USERNAME)
  const password = normalizeEnvValue(env.BOOTSTRAP_ADMIN_PASSWORD)

  if ((username && !password) || (!username && password)) {
    throw new Error(
      'BOOTSTRAP_ADMIN_USERNAME 与 BOOTSTRAP_ADMIN_PASSWORD 必须同时设置或同时省略',
    )
  }

  if (!username || !password) {
    return target
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
    ...target,
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

function parseDatabaseTarget(databaseUrl: string): DatabaseTarget {
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
  const username = url.username ? `${decodeURIComponent(url.username)}@` : ''
  const port = url.port ? `:${url.port}` : ''

  return `${url.protocol}//${username}${url.hostname}${port}/${databaseName}`
}

function findMatchedDenyToken(target: DatabaseTarget, denyTokens: string[]) {
  const haystack = [target.hostname, target.databaseName, target.username]
    .join('/')
    .toLowerCase()

  return denyTokens.find((token) => haystack.includes(token))
}
