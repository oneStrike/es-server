import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import * as schema from '@db/schema'
import { buildRelations } from 'drizzle-orm'
import ts from 'typescript'

const SOURCE_FILE_PATTERN = /\.(?:[cm]?ts|[cm]?js)$/
const SKIPPED_DIRECTORIES = new Set(['.git', '.omx', 'dist', 'node_modules'])
const LEGACY_SCHEMA_DIRECTORIES = ['admin', 'app', 'system', 'work']
const LEGACY_RELATION_FILES = [
  'admin.ts',
  'app.ts',
  'application.ts',
  'platform.ts',
  'system.ts',
  'work.ts',
]
const RELATION_PART_OWNERS = [
  ['app-content', 'app-content', 'appContentRelations'],
  ['base', undefined, 'baseRelations'],
  ['commerce', 'commerce', 'commerceRelations'],
  ['configuration', 'configuration', 'configurationRelations'],
  ['content', 'content', 'contentRelations'],
  ['eventing', 'eventing', 'eventingRelations'],
  ['forum', 'forum', 'forumRelations'],
  ['growth', 'growth', 'growthRelations'],
  ['identity', 'identity', 'identityRelations'],
  ['interaction', 'interaction', 'interactionRelations'],
  ['message', 'message', 'messageRelations'],
  ['observability', 'observability', 'observabilityRelations'],
  ['workflow', 'workflow', 'workflowRelations'],
] as const
const SCHEMA_CAPABILITY_OWNERS = new Set([
  ...RELATION_PART_OWNERS.flatMap(([, schemaOwner]) =>
    schemaOwner ? [schemaOwner] : [],
  ),
  'moderation',
])
const CANONICAL_RELATION_PART_FILES = new Set(
  RELATION_PART_OWNERS.map(([part]) => `${part}.ts`),
)
const RELATIONLESS_SCHEMA_TABLES = new Set([
  'adminRbacRevision',
  'currencyPackage',
  'growthRewardRule',
  'messageWsMetric',
  'migrationAudit',
  'sensitiveWord',
  'sensitiveWordHitLog',
  'userCommentFloorCounter',
])
const RUNTIME_LIBRARY_OWNERS = new Set([
  'account',
  'app-content',
  'config',
  'content',
  'eventing',
  'forum',
  'growth',
  'identity',
  'interaction',
  'message',
  'moderation',
  'observability',
  'platform',
  'user',
  'workflow',
])
const GLOBAL_INFRASTRUCTURE_ALLOWLIST = new Set([
  'libs/platform/src/modules/auth/auth.module.ts',
  'libs/platform/src/modules/crypto/crypto.module.ts',
  'libs/platform/src/modules/geo/geo.module.ts',
  'libs/platform/src/modules/logger/logger.module.ts',
])

function toRepoPath(root: string, filePath: string) {
  return relative(root, filePath).replaceAll('\\', '/')
}

function collectSourceFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return []
  }

  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        files.push(...collectSourceFiles(entryPath))
      }
      continue
    }
    if (entry.isFile() && SOURCE_FILE_PATTERN.test(entry.name)) {
      files.push(entryPath)
    }
  }
  return files
}

function readImportSources(source: string) {
  const importSources = new Set<string>()
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      importSources.add(match[1])
    }
  }

  return [...importSources]
}

function isInternalDbPath(source: string) {
  return (
    source.startsWith('@db/core/') ||
    source.startsWith('@db/schema/') ||
    source.startsWith('@db/relations') ||
    /(?:^|\/)db\/(?:core|schema|relations)(?:\/|$)/.test(source)
  )
}

function isGenericPersistenceFile(relativePath: string) {
  return /repository|\bdao\b|table[-_]?manager/i.test(relativePath)
}

function collectImportViolations(
  root: string,
  directory: string,
  isAppRuntime: boolean,
) {
  const violations: string[] = []
  for (const filePath of collectSourceFiles(directory)) {
    const relativePath = toRepoPath(root, filePath)
    const source = readFileSync(filePath, 'utf8')
    for (const importSource of readImportSources(source)) {
      if (isAppRuntime && importSource.startsWith('@db/')) {
        violations.push(
          `${relativePath}: app runtime code must not import ${importSource}`,
        )
        continue
      }
      if (isInternalDbPath(importSource)) {
        violations.push(
          `${relativePath}: business code must not import internal DB path ${importSource}`,
        )
      }
    }
    if (isGenericPersistenceFile(relativePath)) {
      violations.push(
        `${relativePath}: generic persistence filename is forbidden`,
      )
    }
  }
  return violations
}

function collectRuntimeOwnerViolations(root: string) {
  const librariesDirectory = join(root, 'libs')
  if (!existsSync(librariesDirectory)) {
    return []
  }

  return readdirSync(librariesDirectory, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && !RUNTIME_LIBRARY_OWNERS.has(entry.name),
    )
    .map(
      (entry) =>
        `libs/${entry.name}: runtime library owner is not registered in the boundary configuration`,
    )
}

function collectPlatformDbViolations(root: string) {
  const violations: string[] = []
  const platformDirectory = join(root, 'libs/platform')
  for (const filePath of collectSourceFiles(platformDirectory)) {
    const relativePath = toRepoPath(root, filePath)
    const source = readFileSync(filePath, 'utf8')
    for (const importSource of readImportSources(source)) {
      if (importSource.startsWith('@db/')) {
        violations.push(
          `${relativePath}: libs/platform must not import database capability ${importSource}`,
        )
      }
    }
  }
  return violations
}

function collectBusinessGlobalViolations(root: string) {
  const violations: string[] = []
  for (const directory of ['apps', 'libs', 'db']) {
    for (const filePath of collectSourceFiles(join(root, directory))) {
      const relativePath = toRepoPath(root, filePath)
      if (GLOBAL_INFRASTRUCTURE_ALLOWLIST.has(relativePath)) {
        continue
      }
      if (/@Global\s*\(\s*\)/.test(readFileSync(filePath, 'utf8'))) {
        violations.push(
          `${relativePath}: custom business @Global() is not allowed`,
        )
      }
    }
  }
  return violations
}

function collectSchemaTableOwners(root: string) {
  const tableOwners = new Map<string, string>()
  const violations: string[] = []

  for (const schemaOwner of SCHEMA_CAPABILITY_OWNERS) {
    for (const filePath of collectSourceFiles(
      join(root, 'db/schema', schemaOwner),
    )) {
      const source = readFileSync(filePath, 'utf8')
      for (const match of source.matchAll(
        /^export const ([A-Za-z]\w*)\s*=\s*snakeCase\.table/gm,
      )) {
        const tableName = match[1]
        const existingOwner = tableOwners.get(tableName)
        if (existingOwner) {
          violations.push(
            `db/schema/${schemaOwner}: table symbol ${tableName} is already owned by db/schema/${existingOwner}`,
          )
          continue
        }
        tableOwners.set(tableName, schemaOwner)
      }
    }
  }

  return { tableOwners, violations }
}

function collectExplicitRelationRoots(relativePath: string, filePath: string) {
  const sourceFile = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
  const violations: string[] = []
  let roots: string[] | undefined

  const visit = (node: ts.Node): void => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isIdentifier(node.expression) ||
      node.expression.text !== 'defineRelationsPart'
    ) {
      ts.forEachChild(node, visit)
      return
    }

    const factory = node.arguments[1]
    if (!factory || !ts.isArrowFunction(factory)) {
      return
    }

    const body = ts.isParenthesizedExpression(factory.body)
      ? factory.body.expression
      : factory.body
    if (!ts.isObjectLiteralExpression(body)) {
      violations.push(
        `${relativePath}: defineRelationsPart callback must return an object literal`,
      )
      return
    }

    roots = []
    for (const property of body.properties) {
      if (
        !ts.isPropertyAssignment(property) ||
        !ts.isIdentifier(property.name)
      ) {
        violations.push(
          `${relativePath}: relation root must use an identifier property assignment`,
        )
        continue
      }
      if (!ts.isObjectLiteralExpression(property.initializer)) {
        violations.push(
          `${relativePath}: relation root ${property.name.text} must use an object literal`,
        )
        continue
      }
      roots.push(property.name.text)
    }
  }

  ts.forEachChild(sourceFile, visit)
  if (!roots) {
    violations.push(`${relativePath}: defineRelationsPart callback must exist`)
  }

  return { roots: roots ?? [], violations }
}

function collectRelationPartViolations(root: string) {
  const violations: string[] = []
  const relationsDirectory = join(root, 'db/relations')
  const relationFiles = existsSync(relationsDirectory)
    ? readdirSync(relationsDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
        .map((entry) => entry.name)
    : []

  for (const file of CANONICAL_RELATION_PART_FILES) {
    if (!relationFiles.includes(file)) {
      violations.push(
        `db/relations/${file}: canonical relation part must exist`,
      )
    }
  }

  for (const file of relationFiles) {
    if (!CANONICAL_RELATION_PART_FILES.has(file)) {
      violations.push(
        `db/relations/${file}: relation part is not in the canonical owner mapping`,
      )
    }
  }

  const registryPath = join(root, 'db/core/drizzle-relations.ts')
  const registrySource = existsSync(registryPath)
    ? readFileSync(registryPath, 'utf8')
    : ''

  for (const [part, schemaOwner, relationPart] of RELATION_PART_OWNERS) {
    if (schemaOwner && !existsSync(join(root, 'db/schema', schemaOwner))) {
      violations.push(
        `db/relations/${part}.ts: mapped schema owner db/schema/${schemaOwner} must exist`,
      )
    }

    const relationImport = new RegExp(
      `import\\s+\\{\\s*${relationPart}\\s*\\}\\s+from\\s+['"]\\.\\.\\/relations\\/${part}['"]`,
    )
    if (!relationImport.test(registrySource)) {
      violations.push(
        `db/core/drizzle-relations.ts: must import ${relationPart} from db/relations/${part}`,
      )
    }
    if (!new RegExp(`\\.\\.\\.${relationPart}\\b`).test(registrySource)) {
      violations.push(
        `db/core/drizzle-relations.ts: must aggregate ${relationPart}`,
      )
    }
  }

  if (/\.\.\/relations\/(?:application|platform)\b/.test(registrySource)) {
    violations.push(
      'db/core/drizzle-relations.ts: legacy application/platform relation parts are forbidden',
    )
  }

  const { tableOwners, violations: tableOwnerViolations } =
    collectSchemaTableOwners(root)
  violations.push(...tableOwnerViolations)
  const relationRootParts = new Map<string, string>()

  for (const [part, schemaOwner] of RELATION_PART_OWNERS) {
    if (!schemaOwner) {
      continue
    }

    const filePath = join(relationsDirectory, `${part}.ts`)
    if (!existsSync(filePath)) {
      continue
    }

    const { roots, violations: rootViolations } = collectExplicitRelationRoots(
      `db/relations/${part}.ts`,
      filePath,
    )
    violations.push(...rootViolations)

    for (const relationRoot of roots) {
      const owner = tableOwners.get(relationRoot)
      if (!owner) {
        violations.push(
          `db/relations/${part}.ts: relation root ${relationRoot} is not a schema table`,
        )
        continue
      }
      if (owner !== schemaOwner) {
        violations.push(
          `db/relations/${part}.ts: relation root ${relationRoot} belongs to db/schema/${owner}`,
        )
      }
      const existingPart = relationRootParts.get(relationRoot)
      if (existingPart) {
        violations.push(
          `db/relations/${part}.ts: relation root ${relationRoot} is already declared by db/relations/${existingPart}.ts`,
        )
        continue
      }
      relationRootParts.set(relationRoot, part)
    }
  }

  for (const [tableName, schemaOwner] of tableOwners) {
    if (
      !RELATIONLESS_SCHEMA_TABLES.has(tableName) &&
      !relationRootParts.has(tableName)
    ) {
      violations.push(
        `db/schema/${schemaOwner}: table ${tableName} must have exactly one explicit owner relation root`,
      )
    }
  }

  for (const tableName of RELATIONLESS_SCHEMA_TABLES) {
    if (!tableOwners.has(tableName)) {
      violations.push(
        `scripts/check-db-boundary.ts: relationless table ${tableName} no longer exists in db/schema`,
      )
    }
  }

  return violations
}

/**
 * 在不建立数据库连接的前提下实际加载 relation registry。
 *
 * Drizzle RC 的 defineRelationsPart 会在模块初始化时构建关系元数据；
 * 只检查目录和 registry 文本不足以捕获跨 part 隐式反向关系的失败。
 */
async function collectRelationRuntimeViolations(root: string) {
  try {
    const relationRegistry = (await import(
      pathToFileURL(join(root, 'db/core/drizzle-relations.ts')).href
    )) as typeof import('../db/core/drizzle-relations')

    const builtRelations = buildRelations(schema, relationRegistry.relations)
    if (Object.keys(builtRelations).length === 0) {
      return [
        'db/core/drizzle-relations.ts: relation registry must export non-empty Drizzle relation metadata',
      ]
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return [
      `db/core/drizzle-relations.ts: Drizzle relation metadata must build without database I/O: ${message}`,
    ]
  }

  return []
}

/**
 * 收集最终 DB 架构不变量的静态违规项。
 */
export async function collectDbBoundaryViolations(root: string) {
  const violations = [
    ...collectImportViolations(root, join(root, 'apps'), true),
    ...collectImportViolations(root, join(root, 'libs'), false),
    ...collectRuntimeOwnerViolations(root),
    ...collectPlatformDbViolations(root),
    ...collectBusinessGlobalViolations(root),
    ...collectRelationPartViolations(root),
    ...(await collectRelationRuntimeViolations(root)),
  ]

  const drizzleModulePath = join(root, 'db/core/drizzle.module.ts')
  if (
    existsSync(drizzleModulePath) &&
    /@Global\s*\(\s*\)/.test(readFileSync(drizzleModulePath, 'utf8'))
  ) {
    violations.push(
      'db/core/drizzle.module.ts: DrizzleModule must not use @Global()',
    )
  }

  const coreIndexPath = join(root, 'db/core/index.ts')
  if (
    existsSync(coreIndexPath) &&
    /export\s*\{\s*relations\s*\}\s*from\s*['"]\.\/drizzle-relations['"]/.test(
      readFileSync(coreIndexPath, 'utf8'),
    )
  ) {
    violations.push(
      'db/core/index.ts: @db/core must not export the relations registry',
    )
  }

  for (const directory of LEGACY_SCHEMA_DIRECTORIES) {
    if (existsSync(join(root, 'db/schema', directory))) {
      violations.push(
        `db/schema/${directory}: legacy schema capability path must not exist`,
      )
    }
  }

  for (const file of LEGACY_RELATION_FILES) {
    if (existsSync(join(root, 'db/relations', file))) {
      violations.push(
        `db/relations/${file}: legacy relation part path must not exist`,
      )
    }
  }

  return violations.sort((left, right) => left.localeCompare(right))
}

function readRoot(argv = process.argv) {
  const args = argv.slice(2)
  if (args.length === 0) {
    return resolve(__dirname, '..')
  }
  if (args.length === 2 && args[0] === '--root') {
    return resolve(args[1])
  }
  throw new Error('Usage: tsx scripts/check-db-boundary.ts [--root <path>]')
}

async function main() {
  const violations = await collectDbBoundaryViolations(readRoot())
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(violation)
    }
    process.exitCode = 1
    return
  }
  console.log('DB boundary check passed')
}

if (require.main === module) {
  void main()
}
