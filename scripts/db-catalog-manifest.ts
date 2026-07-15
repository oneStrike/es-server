import type {
  CanonicalCatalog,
  CanonicalMigrationAuthorization,
} from '../db/canonical-epoch'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import process from 'node:process'
import { Pool } from 'pg'
import {
  assertCanonicalManifestDigests,
  assertCanonicalStaticInputs,
  assertCanonicalTarget,
  assertCanonicalTextInputsUseLf,
  beginCanonicalTransaction,
  buildCanonicalManifest,
  CANONICAL_EPOCH,
  CanonicalEpochError,
  collectCanonicalCatalog,
  getCanonicalManifestDigest,
  getCanonicalManifestPath,
  readCanonicalEpochPolicy,
  readCanonicalManifest,
  renderCanonicalManifest,
} from '../db/canonical-epoch'
import {
  assertRegisteredCanonicalTarget,
  readCanonicalTargetRegistry,
} from '../db/canonical-target-registry'
import { buildSchemaCommentsArtifact } from '../db/comments/schema-comments'
import { readCanonicalMigrationAuthorization } from '../db/runtime-guard'

type Command = 'check' | 'generate'

const REPOSITORY_ROOT = resolve(__dirname, '..')
const MIGRATIONS_DIRECTORY = resolve(REPOSITORY_ROOT, 'db', 'migration')
function readCommand(argv = process.argv): Command {
  const args = argv.slice(2)
  if (
    args.length !== 1 ||
    (args[0] !== '--generate' && args[0] !== '--check')
  ) {
    throw new Error('Exactly one of --generate or --check is required')
  }
  return args[0] === '--generate' ? 'generate' : 'check'
}

async function main() {
  const command = readCommand()
  const database = readCanonicalMigrationAuthorization(
    process.env,
    'db:catalog requires DATABASE_URL',
  )
  const authorization: CanonicalMigrationAuthorization = {
    disposableAuthorization: database.disposableAuthorization,
    epoch: database.epoch,
    initializeAuthorization: database.initializeAuthorization,
    targetFingerprint: database.targetFingerprint,
  }
  assertSingleMigrationLine(command)
  assertGeneratedCommentsCurrent()
  readCanonicalEpochPolicy()
  assertCanonicalTextInputsUseLf()

  const pool = new Pool({
    connectionString: database.databaseUrl,
    max: 1,
  })
  const client = await pool.connect()
  let transactionStarted = false

  try {
    await beginCanonicalTransaction(client, true)
    transactionStarted = true
    const identity = await assertCanonicalTarget(client, authorization)
    const registration = assertRegisteredCanonicalTarget(
      identity,
      readCanonicalTargetRegistry(process.env),
    )
    if (command === 'generate' && registration.name !== 'generation') {
      throw new Error(
        'Catalog generation is restricted to the registered generation target',
      )
    }
    const collected = await collectCanonicalCatalog(client, identity.roleOid)
    assertDatabaseCommentsMatchGenerated(collected.catalog)
    const rebuilt = buildCanonicalManifest(collected.catalog, collected.journal)
    assertCanonicalManifestDigests(rebuilt)
    const rebuiltBytes = renderCanonicalManifest(rebuilt)
    const manifestPath = getCanonicalManifestPath()

    if (command === 'generate') {
      writeFileSync(manifestPath, rebuiltBytes, 'utf8')
    } else {
      const existing = readCanonicalManifest()
      assertCanonicalStaticInputs(existing)
      if (renderCanonicalManifest(existing) !== rebuiltBytes) {
        throw new Error('Canonical catalog manifest does not match the target')
      }
    }

    process.stdout.write(
      `${JSON.stringify({
        command,
        epoch: CANONICAL_EPOCH,
        manifestDigest: getCanonicalManifestDigest(rebuilt),
        status: 'pass',
        structureDigest: rebuilt.structureDigest,
        targetFingerprint: identity.fingerprint,
      })}\n`,
    )
  } finally {
    if (transactionStarted) {
      await client.query('ROLLBACK')
    }
    client.release()
    await pool.end()
  }
}

function assertSingleMigrationLine(command: Command) {
  const entries = readdirSync(MIGRATIONS_DIRECTORY, {
    withFileTypes: true,
  })
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  if (directories.length !== 1 || directories[0] !== CANONICAL_EPOCH) {
    throw new Error('db/migration must contain exactly the canonical epoch')
  }

  const manifestPath = getCanonicalManifestPath()
  const manifestPaths = listFiles(MIGRATIONS_DIRECTORY).filter((path) =>
    path.endsWith('catalog-manifest.json'),
  )
  if (
    manifestPaths.length > 1 ||
    (manifestPaths.length === 1 && manifestPaths[0] !== manifestPath) ||
    (command === 'check' && !existsSync(manifestPath))
  ) {
    throw new Error('Canonical catalog manifest path is not unique')
  }
}

function assertGeneratedCommentsCurrent() {
  const artifact = buildSchemaCommentsArtifact()
  if (artifact.warnings.length > 0) {
    throw new Error('Schema comments contain unresolved warnings')
  }
  const current = readFileSync(artifact.outputPath, 'utf8').replace(
    /\r\n/gu,
    '\n',
  )
  if (current !== artifact.sql) {
    throw new Error('Generated schema comments are stale')
  }
}

function assertDatabaseCommentsMatchGenerated(catalog: CanonicalCatalog) {
  const artifact = buildSchemaCommentsArtifact()
  const expected = parseGeneratedComments(artifact.sql)
  if (JSON.stringify(catalog.comments) !== JSON.stringify(expected)) {
    throw new Error('Database comments do not match db/comments/generated.sql')
  }
}

function parseGeneratedComments(sql: string) {
  const result: CanonicalCatalog['comments'] = []
  const identifier = '"((?:[^"]|"")+)"'
  const tablePattern = new RegExp(
    `^COMMENT ON TABLE ${identifier}\\.${identifier} IS E'((?:[^']|'')*)';$`,
    'u',
  )
  const columnPattern = new RegExp(
    `^COMMENT ON COLUMN ${identifier}\\.${identifier}\\.${
      identifier
    } IS E'((?:[^']|'')*)';$`,
    'u',
  )

  for (const line of sql.split('\n')) {
    const tableMatch = line.match(tablePattern)
    if (tableMatch) {
      result.push({
        kind: 'relation',
        schema: decodeIdentifier(tableMatch[1] ?? ''),
        relation: decodeIdentifier(tableMatch[2] ?? ''),
        column: null,
        text: decodePgEscapeString(tableMatch[3] ?? ''),
      })
      continue
    }
    const columnMatch = line.match(columnPattern)
    if (columnMatch) {
      result.push({
        kind: 'column',
        schema: decodeIdentifier(columnMatch[1] ?? ''),
        relation: decodeIdentifier(columnMatch[2] ?? ''),
        column: decodeIdentifier(columnMatch[3] ?? ''),
        text: decodePgEscapeString(columnMatch[4] ?? ''),
      })
    }
  }
  return result
}

function decodeIdentifier(value: string) {
  return value.replaceAll('""', '"')
}

function decodePgEscapeString(value: string) {
  return value
    .replaceAll("''", "'")
    .replaceAll('\\n', '\n')
    .replaceAll('\\\\', '\\')
}

function listFiles(directory: string): string[] {
  const result: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      result.push(...listFiles(path))
    } else if (entry.isFile()) {
      result.push(path)
    }
  }
  return result.sort((left, right) => {
    const leftPath = relative(REPOSITORY_ROOT, left).replaceAll('\\', '/')
    const rightPath = relative(REPOSITORY_ROOT, right).replaceAll('\\', '/')
    return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0
  })
}

main().catch((error) => {
  const digest = createHash('sha256')
    .update(error instanceof Error ? error.message : String(error))
    .digest('hex')
  process.stderr.write(
    `${JSON.stringify({
      errorDigest: digest,
      reasonCode:
        error instanceof CanonicalEpochError
          ? error.reasonCode
          : 'CATALOG_COMMAND_FAILED',
      status: 'reject',
    })}\n`,
  )
  process.exitCode = 1
})
