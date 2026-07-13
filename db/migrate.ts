import type { PoolClient } from 'pg'
import process from 'node:process'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { applySchemaComments } from './comments/schema-comments'
import {
  acquireMigrationSessionLock,
  readMigrationLockTimeoutMs,
  releaseMigrationSessionLock,
} from './migration-session-lock'
import {
  DEFAULT_ACTIVE_MIGRATIONS_DIRECTORY,
  inspectActiveDrizzleMigrationHistory,
} from './operations/migration/active-history'
import { hashCanonicalJson } from './operations/migration/canonical-json'
import { readRegisteredDisposableDatabaseTarget } from './targets/registered-disposable-target'

const MIGRATIONS_SCHEMA = 'public'
const MIGRATIONS_TABLE = '__drizzle_migrations__'

interface ActiveMigrationCommand {
  checkEnvironmentOnly: boolean
  mode: 'active'
  targetId: string
}

export type MigrationCommand = ActiveMigrationCommand

interface DbMigrationRecord {
  appliedAt: string | null
  createdAt: string
  hash: string
  id: number
  name: string | null
}

interface MigrationTableSnapshot {
  columns: string[]
  exists: boolean
  records: DbMigrationRecord[]
}

interface ActiveMigrationInput {
  activeHistory: ReturnType<typeof inspectActiveDrizzleMigrationHistory>
  migrationsDirectory: string
  mode: 'active'
}

type MigrationInput = ActiveMigrationInput

interface MigrationRunResultBase {
  comments: {
    appliedStatementCount: number
    sqlSha256: string
  }
  journalAfterDigest: string
  journalBeforeDigest: string
  journalChanged: boolean
  migrationFolderDigest: string
  targetId: string
}

/** 正常 append-only active history 的 migration 结果。 */
export interface ActiveMigrationRunResult extends MigrationRunResultBase {
  migrationCount: number
  migrationDigest: string
  mode: 'active'
}

export type MigrationRunResult = ActiveMigrationRunResult

function readMigrationCommand(argv = process.argv): MigrationCommand {
  const args = argv.slice(2)
  let checkEnvironmentOnly = false
  let mode: MigrationCommand['mode'] | undefined
  let targetId: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    switch (argument) {
      case '--check-env': {
        if (checkEnvironmentOnly) {
          throw new Error('--check-env may be specified only once')
        }
        checkEnvironmentOnly = true
        break
      }
      case '--mode': {
        if (mode) {
          throw new Error('--mode may be specified only once')
        }
        const value = args[index + 1]
        if (value !== 'active') {
          throw new Error('--mode must be active')
        }
        mode = value
        index += 1
        break
      }
      case '--target-id': {
        if (targetId) {
          throw new Error('--target-id may be specified only once')
        }
        const value = args[index + 1]
        if (!value || value.startsWith('--')) {
          throw new Error('--target-id requires a registered target id')
        }
        targetId = value
        index += 1
        break
      }
      default:
        throw new Error(`Unknown migration argument: ${argument}`)
    }
  }

  if (!mode || !targetId) {
    throw new Error('--mode and --target-id are both required')
  }
  return { checkEnvironmentOnly, mode, targetId }
}

function readMigrationInput(): MigrationInput {
  return {
    activeHistory: inspectActiveDrizzleMigrationHistory(
      DEFAULT_ACTIVE_MIGRATIONS_DIRECTORY,
    ),
    migrationsDirectory: DEFAULT_ACTIVE_MIGRATIONS_DIRECTORY,
    mode: 'active',
  }
}

async function readTargetIdentity(client: PoolClient) {
  const result = await client.query<{
    backend_pid: number
    database_name: string
  }>(
    'SELECT current_database() AS database_name, pg_backend_pid() AS backend_pid',
  )
  const identity = result.rows[0]
  if (!identity) {
    throw new Error('Unable to read migration database identity')
  }
  return {
    backendPid: Number(identity.backend_pid),
    databaseName: identity.database_name,
  }
}

async function getMigrationTableSnapshot(
  client: PoolClient,
): Promise<MigrationTableSnapshot> {
  const columnsResult = await client.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position
    `,
    [MIGRATIONS_SCHEMA, MIGRATIONS_TABLE],
  )
  const columns = columnsResult.rows.map((row) => row.column_name)
  if (columns.length === 0) {
    return { columns: [], exists: false, records: [] }
  }

  const requiredColumns = ['id', 'hash', 'created_at', 'name', 'applied_at']
  const missingColumns = requiredColumns.filter(
    (column) => !columns.includes(column),
  )
  if (missingColumns.length > 0) {
    throw new Error(
      `Migration journal must use the current Drizzle RC shape: ${missingColumns.join(', ')}`,
    )
  }

  const recordsResult = await client.query<{
    applied_at: Date | string | null
    created_at: Date | number | string
    hash: string
    id: number | string
    name: string | null
  }>(
    `
      SELECT "id", "hash", "created_at", "name", "applied_at"
      FROM "public"."__drizzle_migrations__"
      ORDER BY "id" ASC
    `,
  )
  return {
    columns,
    exists: true,
    records: recordsResult.rows.map((record) => ({
      appliedAt: record.applied_at === null ? null : String(record.applied_at),
      createdAt: String(record.created_at),
      hash: String(record.hash),
      id: Number(record.id),
      name: record.name === null ? null : String(record.name),
    })),
  }
}

function assertCurrentJournalShape(snapshot: MigrationTableSnapshot): void {
  if (!snapshot.exists) {
    throw new Error('Migration journal was not created')
  }
  const requiredColumns = ['id', 'hash', 'created_at', 'name', 'applied_at']
  const missingColumns = requiredColumns.filter(
    (column) => !snapshot.columns.includes(column),
  )
  if (missingColumns.length > 0) {
    throw new Error(
      `Drizzle migration journal is not in the current RC shape: ${missingColumns.join(', ')}`,
    )
  }
}

function assertActiveMigrationJournal(
  snapshot: MigrationTableSnapshot,
  input: ActiveMigrationInput,
): void {
  assertActiveMigrationJournalPrefix(snapshot, input)
  if (snapshot.records.length !== input.activeHistory.migrations.length) {
    throw new Error(
      `Active migration journal count ${snapshot.records.length} does not match local history ${input.activeHistory.migrations.length}`,
    )
  }
}

function assertActiveMigrationJournalPrefix(
  snapshot: MigrationTableSnapshot,
  input: ActiveMigrationInput,
): void {
  assertCurrentJournalShape(snapshot)
  const expectedMigrations = input.activeHistory.migrations
  if (snapshot.records.length > expectedMigrations.length) {
    throw new Error(
      `Active migration journal count ${snapshot.records.length} exceeds local history ${expectedMigrations.length}`,
    )
  }

  for (const [index, record] of snapshot.records.entries()) {
    const expected = expectedMigrations[index]
    if (!expected || record.name !== expected.name) {
      throw new Error(
        `Active migration journal is not an append-only prefix at position ${index + 1}`,
      )
    }
    if (record.hash !== expected.sha256) {
      throw new Error(
        `Active migration SQL hash changed after application: ${record.name}`,
      )
    }
  }
}

function assertMigrationJournalPreflight(
  snapshot: MigrationTableSnapshot,
  input: MigrationInput,
): void {
  if (!snapshot.exists || snapshot.records.length === 0) {
    return
  }
  assertActiveMigrationJournalPrefix(snapshot, input)
}

function migrationJournalDigest(snapshot: MigrationTableSnapshot): string {
  return hashCanonicalJson({
    columns: [...snapshot.columns].sort((left, right) =>
      left.localeCompare(right),
    ),
    exists: snapshot.exists,
    // `applied_at` is populated by the database clock for each independent
    // execution. It remains a required current-RC journal column, but it is
    // not part of migration identity and therefore cannot participate in a
    // cross-cluster logical journal comparison.
    records: snapshot.records.map(({ createdAt, hash, id, name }) => ({
      createdAt,
      hash,
      id,
      name,
    })),
  })
}

function buildEnvironmentReadyOutput(
  input: MigrationInput,
  target: ReturnType<typeof readRegisteredDisposableDatabaseTarget>,
): Record<string, unknown> {
  return {
    migrationCount: input.activeHistory.migrationCount,
    migrationDigest: input.activeHistory.migrationDigest,
    migrationsDirectory: input.activeHistory.migrationsDirectory,
    mode: input.mode,
    status: 'environment-ready',
    target: target.safeLabel,
  }
}

function buildRunResult(
  input: MigrationInput,
  targetId: string,
  comments: Awaited<ReturnType<typeof applySchemaComments>>,
  beforeJournal: MigrationTableSnapshot,
  afterJournal: MigrationTableSnapshot,
): MigrationRunResult {
  const base = {
    comments: {
      appliedStatementCount: comments.appliedStatementCount,
      sqlSha256: comments.sqlSha256,
    },
    journalAfterDigest: migrationJournalDigest(afterJournal),
    journalBeforeDigest: migrationJournalDigest(beforeJournal),
    journalChanged:
      migrationJournalDigest(beforeJournal) !==
      migrationJournalDigest(afterJournal),
    migrationFolderDigest: input.activeHistory.migrationDigest,
    targetId,
  }
  return {
    ...base,
    migrationCount: input.activeHistory.migrationCount,
    migrationDigest: input.activeHistory.migrationDigest,
    mode: 'active',
  }
}

export function runMigration(
  command: ActiveMigrationCommand,
): Promise<ActiveMigrationRunResult>
export function runMigration(
  command: MigrationCommand,
): Promise<MigrationRunResult>
export async function runMigration(
  command: MigrationCommand,
): Promise<MigrationRunResult> {
  const migrationInput = readMigrationInput()
  const target = readRegisteredDisposableDatabaseTarget(command.targetId)
  const lockTimeoutMs = readMigrationLockTimeoutMs()

  if (command.checkEnvironmentOnly) {
    process.stdout.write(
      `${JSON.stringify(buildEnvironmentReadyOutput(migrationInput, target))}\n`,
    )
    return {
      comments: { appliedStatementCount: 0, sqlSha256: '' },
      journalAfterDigest: '',
      journalBeforeDigest: '',
      journalChanged: false,
      migrationCount: migrationInput.activeHistory.migrationCount,
      migrationDigest: migrationInput.activeHistory.migrationDigest,
      migrationFolderDigest: migrationInput.activeHistory.migrationDigest,
      mode: 'active',
      targetId: target.id,
    }
  }

  const pool = new Pool({
    connectionString: target.url,
    max: 1,
  })
  let client: PoolClient | undefined
  let lockAcquired = false
  let primaryError: unknown
  let releaseError: unknown
  let result: MigrationRunResult | undefined

  try {
    client = await pool.connect()
    const identity = await readTargetIdentity(client)
    if (identity.databaseName !== target.databaseName) {
      throw new Error(
        `Connected database ${identity.databaseName} does not match registered target ${target.databaseName}`,
      )
    }

    const lock = await acquireMigrationSessionLock(client, lockTimeoutMs)
    lockAcquired = true
    const beforeJournal = await getMigrationTableSnapshot(client)
    assertMigrationJournalPreflight(beforeJournal, migrationInput)
    const db = drizzle({ client })
    const migrationResult = await migrate(db, {
      migrationsFolder: migrationInput.migrationsDirectory,
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE,
    })
    if (migrationResult) {
      throw new Error(
        `Drizzle migrator returned initialization failure: ${migrationResult.exitCode}`,
      )
    }

    const afterJournal = await getMigrationTableSnapshot(client)
    assertActiveMigrationJournal(afterJournal, migrationInput)
    const comments = await applySchemaComments({ executor: client })
    result = buildRunResult(
      migrationInput,
      target.id,
      comments,
      beforeJournal,
      afterJournal,
    )
    const runDigest = hashCanonicalJson(result)
    process.stdout.write(
      `${JSON.stringify({
        backendPid: identity.backendPid,
        lockAttempts: lock.attempts,
        mode: migrationInput.mode,
        runDigest,
        status: 'pass',
        target: target.safeLabel,
        migrationCount: result.migrationCount,
        migrationDigest: result.migrationDigest,
      })}\n`,
    )
  } catch (error) {
    primaryError = error
    throw error
  } finally {
    if (client && lockAcquired) {
      try {
        await releaseMigrationSessionLock(client)
      } catch (error) {
        if (primaryError) {
          console.error('Migration session lock release failed', error)
        } else {
          releaseError = error
        }
      }
    }
    client?.release()
    await pool.end()
  }

  if (releaseError) {
    throw releaseError
  }
  if (!result) {
    throw new Error('Migration did not produce a verification result')
  }
  return result
}

async function main(): Promise<void> {
  await runMigration(readMigrationCommand())
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}

export { readMigrationCommand }
