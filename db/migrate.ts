import type { PoolClient } from 'pg'
import type {
  CanonicalClassification,
  CanonicalMigrationAuthorization,
} from './canonical-epoch'
import { resolve } from 'node:path'
import process from 'node:process'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import {
  assertCanonicalTextInputsUseLf,
  beginCanonicalTransaction,
  classifyCanonicalEpoch,
  readCanonicalTargetIdentity,
} from './canonical-epoch'
import { consumeCanonicalGateCMigrationSession } from './canonical-gate-c-session'
import { verifyCanonicalRecoveryEpoch } from './canonical-recovery-epoch'
import {
  assertRegisteredCanonicalTarget,
  readCanonicalTargetRegistry,
} from './canonical-target-registry'
import { applySchemaComments } from './comments/schema-comments'
import {
  acquireMigrationSessionLock,
  readMigrationLockTimeoutMs,
  releaseMigrationSessionLock,
} from './migration-session-lock'
import { readCanonicalMigrationAuthorization } from './runtime-guard'

const MIGRATIONS_SCHEMA = 'public'
const MIGRATIONS_TABLE = '__drizzle_migrations__'
const MIGRATIONS_DIRECTORY = resolve(__dirname, 'migration')

export interface MigrationCommand {
  checkEnvironmentOnly: boolean
  mode: 'active' | 'preflight'
}

export interface MigrationRunResult {
  classification: CanonicalClassification | null
  comments: {
    appliedStatementCount: number
    sqlSha256: string
  }
  mode: MigrationCommand['mode']
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
        if (value !== 'active' && value !== 'preflight') {
          throw new Error('--mode must be active or preflight')
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
  database: ReturnType<typeof readCanonicalMigrationAuthorization>,
): Record<string, unknown> {
  return {
    database: database.safeLabel,
    mode: command.mode,
    status: 'environment-ready',
  }
}

function buildRunResult(
  mode: MigrationCommand['mode'],
  classification: CanonicalClassification,
  comments: Awaited<ReturnType<typeof applySchemaComments>>,
): MigrationRunResult {
  return {
    classification,
    comments: {
      appliedStatementCount: comments.appliedStatementCount,
      sqlSha256: comments.sqlSha256,
    },
    mode,
  }
}

async function classifyInReadOnlyTransaction(
  client: PoolClient,
  authorization: CanonicalMigrationAuthorization,
) {
  await beginCanonicalTransaction(client, true)
  try {
    return await classifyCanonicalEpoch(client, authorization)
  } finally {
    await client.query('ROLLBACK')
  }
}

function assertAcceptedClassification(classification: CanonicalClassification) {
  if (classification.state !== 'REJECT') {
    return
  }
  const reason = classification.reasonCode ?? 'CATALOG_REJECTED'
  throw new Error(`Canonical catalog rejected: ${reason}`)
}

export async function runMigration(
  command: MigrationCommand,
): Promise<MigrationRunResult> {
  const database = readCanonicalMigrationAuthorization(
    process.env,
    'db:migrate 需要 DATABASE_URL',
  )
  const lockTimeoutMs = readMigrationLockTimeoutMs()

  if (command.checkEnvironmentOnly) {
    process.stdout.write(
      `${JSON.stringify(buildEnvironmentReadyOutput(command, database))}\n`,
    )
    return {
      classification: null,
      comments: { appliedStatementCount: 0, sqlSha256: '' },
      mode: command.mode,
    }
  }

  assertCanonicalTextInputsUseLf()

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

    const authorization: CanonicalMigrationAuthorization = {
      disposableAuthorization: database.disposableAuthorization,
      epoch: database.epoch,
      ...(database.initializeAuthorization
        ? { initializeAuthorization: database.initializeAuthorization }
        : {}),
      targetFingerprint: database.targetFingerprint,
    }
    const canonicalIdentity = await readCanonicalTargetIdentity(client)
    const targetRegistry = readCanonicalTargetRegistry(process.env)
    const registration = assertRegisteredCanonicalTarget(
      canonicalIdentity,
      targetRegistry,
    )

    if (command.mode === 'active') {
      await acquireMigrationSessionLock(client, lockTimeoutMs)
      lockAcquired = true
      await client.query('SET search_path = public, pg_catalog')
      const searchPath = await client.query<{ search_path: string }>(
        "SELECT current_setting('search_path') AS search_path",
      )
      if (searchPath.rows[0]?.search_path !== 'public, pg_catalog') {
        throw new Error('Migration session search_path is not canonical')
      }
    }

    let classification = await classifyInReadOnlyTransaction(
      client,
      authorization,
    )
    if (command.mode === 'preflight') {
      assertAcceptedClassification(classification)
      result = buildRunResult(command.mode, classification, {
        appliedStatementCount: 0,
        outputPath: '',
        sqlSha256: '',
      })
    } else {
      let comments = {
        appliedStatementCount: 0,
        outputPath: '',
        sqlSha256: '',
      }

      if (
        classification.state === 'REJECT' &&
        !classification.commentsRepairAllowed
      ) {
        assertAcceptedClassification(classification)
      }

      if (registration.name === 'C') {
        const recovery = verifyCanonicalRecoveryEpoch(process.env, {
          targetIdentityDigest: canonicalIdentity.fingerprint,
          targetRegistryDigest: targetRegistry.digest,
        })
        consumeCanonicalGateCMigrationSession(
          process.env,
          canonicalIdentity,
          registration,
          recovery,
        )
      }

      if (classification.state === 'NEW') {
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
        comments = await applySchemaComments({ executor: client })
      } else if (
        classification.state === 'REJECT' &&
        classification.commentsRepairAllowed
      ) {
        comments = await applySchemaComments({ executor: client })
      } else {
        assertAcceptedClassification(classification)
      }

      classification = await classifyInReadOnlyTransaction(
        client,
        authorization,
      )
      if (classification.state !== 'CURRENT') {
        assertAcceptedClassification(classification)
        throw new Error('Canonical migration did not reach CURRENT')
      }
      result = buildRunResult(command.mode, classification, comments)
    }
    process.stdout.write(
      `${JSON.stringify({
        backendPid: identity.backendPid,
        database: database.safeLabel,
        classification: result.classification.state,
        mode: command.mode,
        status: 'pass',
        target: registration.name,
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
