import { execSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { applySchemaComments } from './comments/schema-comments'

const MIGRATIONS_SCHEMA = 'public'
const MIGRATIONS_TABLE = '__drizzle_migrations__'

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS'
type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Error
  | Record<string, string | number | boolean | null>
  | Array<string | number | boolean | null>

interface LocalMigrationMeta {
  name: string
  hasMigrationSql: boolean
  hasSnapshot: boolean
}

interface DbMigrationRecord {
  id: number
  hash: string
  createdAt: string
  name: string | null
  appliedAt: string | null
}

interface MigrationTableSnapshot {
  exists: boolean
  columns: string[]
  records: DbMigrationRecord[]
}

function hasRunnableLocalMigrations(localMigrations: LocalMigrationMeta[]) {
  return localMigrations.some(migration => migration.hasMigrationSql)
}

function log(level: LogLevel, message: string, details?: Record<string, LogValue>) {
  console.log(`[${new Date().toISOString()}] [${level}] ${message}`)

  if (!details) {
    return
  }

  for (const [key, value] of Object.entries(details)) {
    console.log(`  - ${key}: ${formatLogValue(value)}`)
  }
}

function formatLogValue(value: LogValue) {
  if (value === undefined) {
    return 'undefined'
  }

  if (value === null) {
    return 'null'
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '(empty)'
    }

    const isPrimitiveList = value.every(item =>
      item === null
      || ['string', 'number', 'boolean'].includes(typeof item),
    )

    return isPrimitiveList
      ? value.map(item => String(item)).join(', ')
      : JSON.stringify(value)
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function formatDuration(ms: number) {
  if (ms < 1000) {
    return `${ms}ms`
  }

  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(2)}s`
  }

  const minutes = Math.floor(ms / 60_000)
  const seconds = ((ms % 60_000) / 1000).toFixed(2)
  return `${minutes}m ${seconds}s`
}

function getRuntimeLabel() {
  return process.versions.bun
    ? `bun ${process.versions.bun}`
    : `node ${process.version}`
}

function serializeError(error: Error | string | number | boolean | null | undefined): string {
  if (error instanceof Error) {
    const parts: string[] = []
    parts.push(error.stack ?? `${error.name}: ${error.message}`)

    // 处理嵌套错误（如 DrizzleQueryError 的 cause）
    let cause = (error as any).cause
    let depth = 0
    while (cause instanceof Error && depth < 5) {
      parts.push(`\n  Caused by: ${cause.stack ?? `${cause.name}: ${cause.message}`}`)
      cause = (cause as any).cause
      depth++
    }

    return parts.join('')
  }

  return String(error)
}

function readLocalMigrations(migrationsFolder: string) {
  if (!existsSync(migrationsFolder)) {
    return []
  }

  return readdirSync(migrationsFolder, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const directoryPath = join(migrationsFolder, entry.name)

      return {
        name: entry.name,
        hasMigrationSql: existsSync(join(directoryPath, 'migration.sql')),
        hasSnapshot: existsSync(join(directoryPath, 'snapshot.json')),
      }
    })
}

async function getMigrationTableSnapshot(pool: Pool) {
  const columnResult = await pool.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position
    `,
    [MIGRATIONS_SCHEMA, MIGRATIONS_TABLE],
  )

  const columns = columnResult.rows.map(row => row.column_name)

  if (columns.length === 0) {
    return {
      exists: false,
      columns: [],
      records: [],
    }
  }

  const selectedColumns = ['id', 'hash', 'created_at']

  if (columns.includes('name')) {
    selectedColumns.push('name')
  }

  if (columns.includes('applied_at')) {
    selectedColumns.push('applied_at')
  }

  const qualifiedTable = `"${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`
  const recordResult = await pool.query<Record<string, unknown>>(
    `SELECT ${selectedColumns.map(column => `"${column}"`).join(', ')} FROM ${qualifiedTable} ORDER BY "id" ASC`,
  )

  return {
    exists: true,
    columns,
    records: recordResult.rows.map(row => ({
      id: Number(row.id ?? 0),
      hash: String(row.hash ?? ''),
      createdAt: String(row.created_at ?? ''),
      name: row.name == null ? null : String(row.name),
      appliedAt: row.applied_at == null ? null : String(row.applied_at),
    })),
  }
}

function getPendingLocalMigrationNames(
  localMigrations: LocalMigrationMeta[],
  snapshot: MigrationTableSnapshot,
): string[] | null {
  if (!snapshot.exists) {
    return localMigrations
      .filter(migration => migration.hasMigrationSql)
      .map(migration => migration.name)
  }

  if (!snapshot.columns.includes('name')) {
    return null
  }

  const appliedNames = new Set(
    snapshot.records
      .map(record => record.name)
      .filter((name): name is string => Boolean(name)),
  )

  return localMigrations
    .filter(migration => migration.hasMigrationSql && !appliedNames.has(migration.name))
    .map(migration => migration.name)
}

function getNewMigrationRecords(
  beforeSnapshot: MigrationTableSnapshot,
  afterSnapshot: MigrationTableSnapshot,
): DbMigrationRecord[] {
  const appliedIds = new Set(beforeSnapshot.records.map(record => record.id))

  return afterSnapshot.records.filter(record => !appliedIds.has(record.id))
}

async function runMigration() {
  const startedAt = Date.now()
  log('INFO', '开始执行数据库迁移', {
    runtime: getRuntimeLabel(),
    pid: process.pid,
    cwd: process.cwd(),
  })
  const migrationsFolder = resolve(__dirname, 'migration')
  // Seed 仍沿用当前基于 cwd 的定位方式，避免改变现有脚本的执行契约。
  const seedTsPath = join(process.cwd(), 'db', 'seed', 'index.ts')
  const localMigrations = readLocalMigrations(migrationsFolder)
  const invalidLocalMigrations = localMigrations.filter(migration => !migration.hasMigrationSql)

  log('INFO', '迁移脚本配置已解析', {
    migrationsFolder,
    migrationsTable: MIGRATIONS_TABLE,
    localMigrationCount: localMigrations.length,
  })

  if (invalidLocalMigrations.length > 0) {
    log('WARN', '检测到缺少 migration.sql 的 migration 目录', {
      invalidMigrationDirectories: invalidLocalMigrations.map(migration => migration.name),
    })
  }

  if (!hasRunnableLocalMigrations(localMigrations)) {
    log('SUCCESS', '未检测到本地 migration 文件，跳过数据库迁移流程', {
      totalCost: formatDuration(Date.now() - startedAt),
    })
    return
  }

  if (!process.env.DATABASE_URL) {
    log('ERROR', 'DATABASE_URL 环境变量未设置')
    throw new Error('DATABASE_URL 环境变量未设置')
  }

  const databaseUrl = process.env.DATABASE_URL

  const pool = new Pool({
    connectionString: databaseUrl,
  })

  const db = drizzle({
    client: pool,
  })

  let isFreshDb = false
  let beforeSnapshot: MigrationTableSnapshot = {
    exists: false,
    columns: [],
    records: [],
  }

  try {
    const connectStartedAt = Date.now()
    log('INFO', '检查数据库连接')
    await pool.query('SELECT 1')
    log('SUCCESS', '数据库连接可用', {
      cost: formatDuration(Date.now() - connectStartedAt),
    })

    beforeSnapshot = await getMigrationTableSnapshot(pool)
    isFreshDb = !beforeSnapshot.exists

    if (isFreshDb) {
      log('INFO', '检测到全新的空数据库，迁移结束后将自动执行 Seed')
    } else {
      log('INFO', '迁移记录表状态', {
        appliedCount: beforeSnapshot.records.length,
      })
    }

    const pendingLocalMigrationNames = getPendingLocalMigrationNames(localMigrations, beforeSnapshot)

    if (pendingLocalMigrationNames === null) {
      log('INFO', '当前无法精确推断待执行 migration 名称', {
        reason: '迁移记录表缺少 name 列，继续交给 Drizzle 按内部状态处理',
      })
    } else if (pendingLocalMigrationNames.length === 0) {
      log('INFO', '未检测到待执行的本地 migration')
    } else {
      log('INFO', '检测到待执行的本地 migration', {
        pendingCount: pendingLocalMigrationNames.length,
      })
    }

    const migrateStartedAt = Date.now()
    log('INFO', '开始调用 Drizzle migrator')
    await migrate(db, {
      migrationsFolder,
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE,
    })

    const afterSnapshot = await getMigrationTableSnapshot(pool)
    const newRecords = getNewMigrationRecords(beforeSnapshot, afterSnapshot)

    if (newRecords.length === 0) {
      log('SUCCESS', '数据库迁移完成，未发现新增迁移记录', {
        cost: formatDuration(Date.now() - migrateStartedAt),
        appliedCount: afterSnapshot.records.length,
      })
    } else {
      log('SUCCESS', '数据库迁移完成', {
        cost: formatDuration(Date.now() - migrateStartedAt),
        newlyAppliedCount: newRecords.length,
        appliedCount: afterSnapshot.records.length,
      })
    }
  } catch (error) {
    log('ERROR', '数据库迁移失败', {
      cost: formatDuration(Date.now() - startedAt),
      error: serializeError(error),
    })
    throw error
  } finally {
    const closeStartedAt = Date.now()
    log('INFO', '关闭数据库连接池')
    await pool.end()
    log('SUCCESS', '数据库连接池已关闭', {
      cost: formatDuration(Date.now() - closeStartedAt),
    })
  }

  if (isFreshDb) {
    const seedStartedAt = Date.now()

    if (!existsSync(seedTsPath)) {
      log('WARN', '找不到种子数据脚本文件，跳过 Auto-Seed', {
        seedTsPath,
      })
    } else {
      log('INFO', '开始自动执行 Seed', {
        seedTsPath,
      })

      try {
        execSync(`bun "${seedTsPath}"`, { stdio: 'inherit' })
        log('SUCCESS', 'Auto-Seed 执行完成', {
          cost: formatDuration(Date.now() - seedStartedAt),
        })
      } catch (seedError) {
        log('ERROR', 'Auto-Seed 执行失败', {
          cost: formatDuration(Date.now() - seedStartedAt),
          error: serializeError(seedError),
        })
        throw seedError
      }
    }
  }

  const commentStartedAt = Date.now()
  log('INFO', '开始同步数据库注释')

  try {
    const result = await applySchemaComments({
      databaseUrl,
    })

    log('SUCCESS', '数据库注释同步完成', {
      cost: formatDuration(Date.now() - commentStartedAt),
      appliedStatementCount: result.appliedStatementCount,
    })
  } catch (error) {
    log('ERROR', '数据库注释同步失败', {
      cost: formatDuration(Date.now() - commentStartedAt),
      error: serializeError(error),
    })
    throw error
  }

  log('SUCCESS', '数据库迁移流程结束', {
    totalCost: formatDuration(Date.now() - startedAt),
  })
}

if (require.main === module) {
  runMigration().catch(() => {
    process.exitCode = 1
  })
}

export {
  hasRunnableLocalMigrations,
  readLocalMigrations,
  runMigration,
}
