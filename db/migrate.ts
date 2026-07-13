import type { PoolClient } from 'pg'
import { resolve } from 'node:path'
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
import { readDatabaseConnection } from './runtime-guard'

const MIGRATIONS_SCHEMA = 'public'
const MIGRATIONS_TABLE = '__drizzle_migrations__'
const MIGRATIONS_DIRECTORY = resolve(__dirname, 'migration')

export interface MigrationCommand {
  checkEnvironmentOnly: boolean
  mode: 'active'
}

export interface MigrationRunResult {
  comments: {
    appliedStatementCount: number
    sqlSha256: string
  }
  mode: 'active'
}

function readMigrationCommand(argv = process.argv): MigrationCommand {
  const args = argv.slice(2)
  let checkEnvironmentOnly = false
  let mode: MigrationCommand['mode'] | undefined

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
      default:
        throw new Error(`Unknown migration argument: ${argument}`)
    }
  }

  if (!mode) {
    throw new Error('--mode is required')
  }
  return { checkEnvironmentOnly, mode }
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

function buildEnvironmentReadyOutput(
  command: MigrationCommand,
  database: ReturnType<typeof readDatabaseConnection>,
): Record<string, unknown> {
  return {
    database: database.safeLabel,
    mode: command.mode,
    status: 'environment-ready',
  }
}

function buildRunResult(
  comments: Awaited<ReturnType<typeof applySchemaComments>>,
): MigrationRunResult {
  return {
    comments: {
      appliedStatementCount: comments.appliedStatementCount,
      sqlSha256: comments.sqlSha256,
    },
    mode: 'active',
  }
}

export async function runMigration(
  command: MigrationCommand,
): Promise<MigrationRunResult> {
  const database = readDatabaseConnection(
    process.env,
    'db:migrate 需要 DATABASE_URL',
  )
  const lockTimeoutMs = readMigrationLockTimeoutMs()

  if (command.checkEnvironmentOnly) {
    process.stdout.write(
      `${JSON.stringify(buildEnvironmentReadyOutput(command, database))}\n`,
    )
    return {
      comments: { appliedStatementCount: 0, sqlSha256: '' },
      mode: command.mode,
    }
  }

  const pool = new Pool({
    connectionString: database.databaseUrl,
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
    if (identity.databaseName !== database.databaseName) {
      throw new Error(
        `Connected database ${identity.databaseName} does not match DATABASE_URL`,
      )
    }

    const lock = await acquireMigrationSessionLock(client, lockTimeoutMs)
    lockAcquired = true
    const db = drizzle({ client })
    const migrationResult = await migrate(db, {
      migrationsFolder: MIGRATIONS_DIRECTORY,
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE,
    })
    if (migrationResult) {
      throw new Error(
        `Drizzle migrator returned initialization failure: ${migrationResult.exitCode}`,
      )
    }

    const comments = await applySchemaComments({ executor: client })
    result = buildRunResult(comments)
    process.stdout.write(
      `${JSON.stringify({
        backendPid: identity.backendPid,
        database: database.safeLabel,
        lockAttempts: lock.attempts,
        mode: command.mode,
        status: 'pass',
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
    throw new Error('Migration did not produce a result')
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
