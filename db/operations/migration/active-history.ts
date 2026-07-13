import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { hashCanonicalJson } from './canonical-json'

const WORKSPACE_ROOT = resolve(__dirname, '..', '..', '..')
export const DEFAULT_ACTIVE_MIGRATIONS_DIRECTORY = resolve(
  WORKSPACE_ROOT,
  'db',
  'migration',
)
const MIGRATION_DIRECTORY_NAME = /^\d{14}_[a-z0-9_]+$/
const FORBIDDEN_FOREIGN_KEY = /\bforeign\s+key\b/iu
const FORBIDDEN_REFERENCES = /\breferences\b/iu

export interface ActiveMigrationFile {
  byteLength: number
  name: string
  sha256: string
}

export interface ActiveMigrationHistory {
  migrationCount: number
  migrationDigest: string
  migrations: ActiveMigrationFile[]
  migrationsDirectory: string
  status: 'pass'
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function toWorkspacePath(path: string): string {
  return relative(WORKSPACE_ROOT, path).replaceAll('\\', '/')
}

function assertWorkspacePath(path: string): void {
  const workspaceRelative = relative(WORKSPACE_ROOT, path)
  if (
    workspaceRelative === '' ||
    workspaceRelative === '..' ||
    workspaceRelative.startsWith(`..${sep}`) ||
    isAbsolute(workspaceRelative)
  ) {
    throw new Error('Active migration directory must stay inside the workspace')
  }
}

function assertNoPhysicalForeignKey(
  migrationName: string,
  migrationSql: string,
): void {
  if (
    FORBIDDEN_FOREIGN_KEY.test(migrationSql) ||
    FORBIDDEN_REFERENCES.test(migrationSql)
  ) {
    throw new Error(
      `Active migration ${migrationName} contains a forbidden physical foreign key declaration`,
    )
  }
}

/**
 * 校验正常 append-only migration history，不施加 candidate init 的「仅一个目录」约束。
 *
 * Drizzle RC migrator 只读取每个 migration 目录下的 migration.sql，并以目录名/name
 * 和 SQL hash 记录 journal；snapshot 不是 runtime migration 输入，因此旧 history 不要求
 * 补齐或伪造 snapshot。
 */
export function inspectActiveDrizzleMigrationHistory(
  migrationsDirectory = DEFAULT_ACTIVE_MIGRATIONS_DIRECTORY,
): ActiveMigrationHistory {
  assertWorkspacePath(migrationsDirectory)
  if (
    !existsSync(migrationsDirectory) ||
    !statSync(migrationsDirectory).isDirectory()
  ) {
    throw new Error(
      `Active migration directory is unavailable: ${toWorkspacePath(migrationsDirectory)}`,
    )
  }

  const legacyJournal = resolve(migrationsDirectory, 'meta', '_journal.json')
  if (existsSync(legacyJournal)) {
    throw new Error(
      `Active migration directory contains unsupported legacy Drizzle journal: ${toWorkspacePath(legacyJournal)}`,
    )
  }

  const rootEntries = readdirSync(migrationsDirectory, {
    encoding: 'utf8',
    withFileTypes: true,
  })
  const rootFiles = rootEntries.filter((entry) => !entry.isDirectory())
  if (rootFiles.length > 0) {
    throw new Error(
      `Active migration directory may only contain migration directories: ${rootFiles
        .map((entry) => entry.name)
        .join(', ')}`,
    )
  }

  const migrationDirectories = rootEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
  if (migrationDirectories.length === 0) {
    throw new Error(
      'Active migration history must contain at least one migration',
    )
  }

  const migrations = migrationDirectories.map((name) => {
    if (!MIGRATION_DIRECTORY_NAME.test(name)) {
      throw new Error(`Invalid active migration directory name: ${name}`)
    }
    const migrationPath = resolve(migrationsDirectory, name, 'migration.sql')
    if (!existsSync(migrationPath) || !statSync(migrationPath).isFile()) {
      throw new Error(`Active migration ${name} is missing migration.sql`)
    }
    const migrationSql = readFileSync(migrationPath, 'utf8')
    if (!migrationSql.trim()) {
      throw new Error(`Active migration ${name} has an empty migration.sql`)
    }
    assertNoPhysicalForeignKey(name, migrationSql)
    return {
      byteLength: statSync(migrationPath).size,
      name,
      sha256: sha256(migrationSql),
    }
  })

  return {
    migrationCount: migrations.length,
    migrationDigest: hashCanonicalJson({ migrations }),
    migrations,
    migrationsDirectory: toWorkspacePath(migrationsDirectory),
    status: 'pass',
  }
}

function main(): void {
  if (process.argv.length !== 2) {
    throw new Error('This check does not accept arguments')
  }
  process.stdout.write(
    `${JSON.stringify(inspectActiveDrizzleMigrationHistory())}\n`,
  )
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
