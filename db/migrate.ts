import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { applySchemaComments } from './comments/schema-comments'

const MIGRATIONS_SCHEMA = 'public'
const MIGRATIONS_TABLE = '__drizzle_migrations__'
const DB_RECORD_PREVIEW_LIMIT = 10
const DATABASE_URL_CREDENTIALS_PATTERN = /\/\/[^@]+@/
const CLOUDY_AMPHIBIAN_MIGRATION_NAME = '20260331053709_cloudy_amphibian'
const CLOUDY_AMPHIBIAN_DB_HASH = '49f2d3b949bb583ec251fef8eae6d6598ed2b24b6fa95ebc6134d6aa3b30a714'
const CLOUDY_AMPHIBIAN_LOCAL_HASH = '5180c1454d7de2ebd0e289bf963db904ae9e2be4a240449c35c1d96a135d15c7'
const LEGACY_GROWTH_LEDGER_SOURCE = 'legacy_migration'

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS'

interface LocalMigrationMeta {
  name: string
  hasMigrationSql: boolean
  hasSnapshot: boolean
  hash: string | null
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

interface AppliedMigrationHashDrift {
  name: string
  dbHash: string
  localHash: string
  appliedAt: string | null
}

function log(level: LogLevel, message: string, details?: Record<string, unknown>) {
  console.log(`[${new Date().toISOString()}] [${level}] ${message}`)

  if (!details) {
    return
  }

  for (const [key, value] of Object.entries(details)) {
    console.log(`  - ${key}: ${formatLogValue(value)}`)
  }
}

function formatLogValue(value: unknown): string {
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

function formatDuration(ms: number): string {
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

function getRuntimeLabel(): string {
  return process.versions.bun
    ? `bun ${process.versions.bun}`
    : `node ${process.version}`
}

function maskDatabaseUrl(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl)

    if (parsed.username) {
      parsed.username = '***'
    }

    if (parsed.password) {
      parsed.password = '***'
    }

    return parsed.toString()
  } catch {
    return databaseUrl.replace(DATABASE_URL_CREDENTIALS_PATTERN, '//***:***@')
  }
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`
  }

  return String(error)
}

function readLocalMigrations(migrationsFolder: string): LocalMigrationMeta[] {
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
        hash: existsSync(join(directoryPath, 'migration.sql'))
          ? createHash('sha256')
              .update(readFileSync(join(directoryPath, 'migration.sql')))
              .digest('hex')
          : null,
      }
    })
}

function printLocalMigrationDetails(localMigrations: LocalMigrationMeta[]) {
  if (localMigrations.length === 0) {
    log('WARN', '迁移目录下未发现任何本地 migration')
    return
  }

  log('INFO', '本地 migration 清单')

  for (const migration of localMigrations) {
    console.log(
      `  - ${migration.name}: migration.sql=${migration.hasMigrationSql ? 'yes' : 'no'}, snapshot.json=${migration.hasSnapshot ? 'yes' : 'no'}`,
    )
  }
}

function printDbMigrationRecords(title: string, records: DbMigrationRecord[]) {
  if (records.length === 0) {
    log('INFO', `${title}: 无`)
    return
  }

  const previewRecords = records.slice(-DB_RECORD_PREVIEW_LIMIT)
  log('INFO', title, {
    totalCount: records.length,
    previewCount: previewRecords.length,
  })

  for (const record of previewRecords) {
    console.log(
      `  - id=${record.id}, name=${record.name ?? '(legacy/no-name)'}, createdAt=${record.createdAt}, appliedAt=${record.appliedAt ?? 'n/a'}, hash=${record.hash}`,
    )
  }

  if (records.length > previewRecords.length) {
    console.log(`  - ... 其余 ${records.length - previewRecords.length} 条未展开`)
  }
}

async function getMigrationTableSnapshot(pool: Pool): Promise<MigrationTableSnapshot> {
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

/**
 * 已执行 migration 如果被后续手改，Drizzle 仍会按 name 视为“已执行”，
 * 这里提前对比 hash，避免进入“迁移已完成但结构已漂移”的静默状态。
 */
function getAppliedMigrationHashDrifts(
  localMigrations: LocalMigrationMeta[],
  snapshot: MigrationTableSnapshot,
): AppliedMigrationHashDrift[] {
  if (!snapshot.exists || !snapshot.columns.includes('name')) {
    return []
  }

  const localMigrationHashMap = new Map(
    localMigrations
      .filter((migration): migration is LocalMigrationMeta & { hash: string } =>
        migration.hasMigrationSql && Boolean(migration.hash),
      )
      .map(migration => [migration.name, migration.hash]),
  )

  return snapshot.records.flatMap((record) => {
    if (!record.name) {
      return []
    }

    const localHash = localMigrationHashMap.get(record.name)

    if (!localHash || localHash === record.hash) {
      return []
    }

    return [{
      name: record.name,
      dbHash: record.hash,
      localHash,
      appliedAt: record.appliedAt,
    }]
  })
}

function printAppliedMigrationHashDrifts(drifts: AppliedMigrationHashDrift[]) {
  if (drifts.length === 0) {
    return
  }

  log('WARN', '检测到已执行 migration 与本地 migration.sql hash 不一致', {
    driftCount: drifts.length,
  })

  for (const drift of drifts) {
    console.log(
      `  - name=${drift.name}, appliedAt=${drift.appliedAt ?? 'n/a'}, dbHash=${drift.dbHash}, localHash=${drift.localHash}`,
    )
  }
}

function isKnownCloudyAmphibianSourceDrift(drift: AppliedMigrationHashDrift): boolean {
  return drift.name === CLOUDY_AMPHIBIAN_MIGRATION_NAME
    && drift.dbHash === CLOUDY_AMPHIBIAN_DB_HASH
    && drift.localHash === CLOUDY_AMPHIBIAN_LOCAL_HASH
}

async function columnExists(
  pool: Pool,
  schemaName: string,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND column_name = $3
      ) AS "exists"
    `,
    [schemaName, tableName, columnName],
  )

  return Boolean(result.rows[0]?.exists)
}

/**
 * 历史上这条 migration 在已落库后被追加了 growth_ledger_record.source，
 * 需要按当前 schema 对旧库做一次幂等补齐，避免注释同步与运行时 DTO 再次踩空列。
 */
async function repairCloudyAmphibianSourceColumn(pool: Pool): Promise<boolean> {
  const sourceExists = await columnExists(pool, 'public', 'growth_ledger_record', 'source')

  if (sourceExists) {
    log('INFO', 'growth_ledger_record.source 已存在，跳过已知 repair')
    return false
  }

  const countResult = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS "count" FROM "public"."growth_ledger_record"',
  )
  const existingRowCount = Number(countResult.rows[0]?.count ?? '0')

  log('WARN', '开始执行已知 migration 漂移 repair', {
    migrationName: CLOUDY_AMPHIBIAN_MIGRATION_NAME,
    target: 'public.growth_ledger_record.source',
    existingRowCount,
    backfillSource: LEGACY_GROWTH_LEDGER_SOURCE,
  })

  const client = await pool.connect()
  let backfilledRowCount = 0

  try {
    await client.query('BEGIN')
    await client.query(
      'ALTER TABLE "public"."growth_ledger_record" ADD COLUMN IF NOT EXISTS "source" varchar(40)',
    )
    const updateResult = await client.query(
      'UPDATE "public"."growth_ledger_record" SET "source" = $1 WHERE "source" IS NULL',
      [LEGACY_GROWTH_LEDGER_SOURCE],
    )
    backfilledRowCount = updateResult.rowCount ?? 0
    await client.query(
      'ALTER TABLE "public"."growth_ledger_record" ALTER COLUMN "source" SET NOT NULL',
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  log('SUCCESS', '已知 migration 漂移 repair 完成', {
    migrationName: CLOUDY_AMPHIBIAN_MIGRATION_NAME,
    existingRowCount,
    backfilledRowCount,
  })

  return true
}

async function repairKnownMigrationDrifts(
  pool: Pool,
  drifts: AppliedMigrationHashDrift[],
): Promise<Set<string>> {
  const handled = new Set<string>()

  if (drifts.some(isKnownCloudyAmphibianSourceDrift)) {
    await repairCloudyAmphibianSourceColumn(pool)
    handled.add(CLOUDY_AMPHIBIAN_MIGRATION_NAME)
  }

  return handled
}

async function runMigration() {
  const startedAt = Date.now()
  log('INFO', '开始执行数据库迁移', {
    runtime: getRuntimeLabel(),
    pid: process.pid,
    cwd: process.cwd(),
  })

  if (!process.env.DATABASE_URL) {
    log('ERROR', 'DATABASE_URL 环境变量未设置')
    throw new Error('DATABASE_URL 环境变量未设置')
  }

  const databaseUrl = process.env.DATABASE_URL
  const migrationsFolder = resolve(__dirname, 'migration')
  // Seed 仍沿用当前基于 cwd 的定位方式，避免改变现有脚本的执行契约。
  const seedTsPath = join(process.cwd(), 'db', 'seed', 'index.ts')
  const localMigrations = readLocalMigrations(migrationsFolder)
  const invalidLocalMigrations = localMigrations.filter(migration => !migration.hasMigrationSql)

  log('INFO', '迁移脚本配置已解析', {
    databaseUrl: maskDatabaseUrl(databaseUrl),
    migrationsFolder,
    migrationsSchema: MIGRATIONS_SCHEMA,
    migrationsTable: MIGRATIONS_TABLE,
    seedTsPath,
    localMigrationCount: localMigrations.length,
  })

  printLocalMigrationDetails(localMigrations)

  if (invalidLocalMigrations.length > 0) {
    log('WARN', '检测到缺少 migration.sql 的 migration 目录', {
      invalidMigrationDirectories: invalidLocalMigrations.map(migration => migration.name),
    })
  }

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
        columns: beforeSnapshot.columns,
        appliedCount: beforeSnapshot.records.length,
      })
      printDbMigrationRecords('迁移前已应用的 migration 记录', beforeSnapshot.records)
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

      for (const migrationName of pendingLocalMigrationNames) {
        console.log(`  - ${migrationName}`)
      }
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
    const appliedHashDrifts = getAppliedMigrationHashDrifts(localMigrations, afterSnapshot)

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
      printDbMigrationRecords('本次新增的 migration 记录', newRecords)
    }

    printAppliedMigrationHashDrifts(appliedHashDrifts)

    const handledHashDrifts = await repairKnownMigrationDrifts(pool, appliedHashDrifts)
    const unhandledHashDrifts = appliedHashDrifts.filter(
      drift => !handledHashDrifts.has(drift.name),
    )

    if (unhandledHashDrifts.length > 0) {
      throw new Error(
        `检测到 ${unhandledHashDrifts.length} 条已执行 migration 的 hash 与本地 migration.sql 不一致，请勿修改已执行 migration 文件；请改为生成新的 migration。`,
      )
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
        command: `bun "${seedTsPath}"`,
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
      commentSqlPath: result.outputPath,
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

runMigration().catch(() => {
  process.exitCode = 1
})
