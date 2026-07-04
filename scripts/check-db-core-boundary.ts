import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const WORKSPACE_ROOT = resolve(__dirname, '..')
const SCAN_ROOTS = ['apps', 'libs', 'db', 'scripts']
const DB_CORE_ROOT = resolve(WORKSPACE_ROOT, 'db', 'core')
const DB_SCHEMA_ROOT = resolve(WORKSPACE_ROOT, 'db', 'schema')
const DB_RELATIONS_ROOT = resolve(WORKSPACE_ROOT, 'db', 'relations')
const PUBLIC_BARREL_PATH = resolve(WORKSPACE_ROOT, 'db', 'core', 'index.ts')

const ALLOWED_CORE_EXPORTS = new Set([
  'Db',
  'DbNotificationSubscription',
  'DbNotificationSubscriptionOptions',
  'DbNotificationService',
  'DrizzleModule',
  'DrizzleMutationResult',
  'DrizzleService',
  'PgTable',
  'seedRelations',
  'SeedDb',
  'SQL',
  'TableConfig',
  'buildILikeCondition',
  'buildLikePattern',
  'extractError',
  'extractRows',
  'getPostgresErrorResponseDescriptor',
  'toPageResult',
])

const FORBIDDEN_CORE_EXPORTS = new Set([
  'DRIZZLE_POOL',
  'DRIZZLE_DB',
  ['DRIZZLE_DB', 'LEGACY'].join('_'),
  ['PG', 'CONNECTION'].join('_'),
  'DrizzlePoolProvider',
  'DrizzleDbProvider',
  ['Drizzle', 'Db', 'LegacyProvider'].join(''),
])

const ALLOWED_CORE_EXPORT_ALIASES = new Map([['seedRelations', 'relations']])

interface BoundaryViolation {
  filePath: string
  message: string
}

const violations: BoundaryViolation[] = []
const TYPE_SCRIPT_FILES = listTypeScriptFiles(SCAN_ROOTS)
const SOURCE_FILES = new Map(
  TYPE_SCRIPT_FILES.map((filePath) => [filePath, createSourceFile(filePath)]),
)

checkCoreImports()
checkForbiddenDbAliasImports()
checkRelativeSchemaImports()
checkRelativeRelationsImports()
checkNoDirectErrorInternalImports()
checkPublicBarrel()

if (violations.length > 0) {
  console.error('@db/core boundary check failed:')

  for (const violation of violations) {
    console.error(`- ${violation.filePath}: ${violation.message}`)
  }

  process.exitCode = 1
} else {
  console.log('@db/core boundary check passed.')
}

function checkCoreImports() {
  for (const filePath of TYPE_SCRIPT_FILES) {
    const sourceFile = getSourceFile(filePath)

    sourceFile.forEachChild((node) => {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) {
        return
      }

      if (getModuleSpecifier(node) !== '@db/core') {
        return
      }

      if (ts.isImportDeclaration(node)) {
        checkCoreImportDeclaration(filePath, node)
        return
      }

      checkCoreExportDeclaration(filePath, node)
    })
  }
}

function checkCoreImportDeclaration(
  filePath: string,
  node: ts.ImportDeclaration,
) {
  const importClause = node.importClause
  if (!importClause) {
    return
  }

  if (importClause.name) {
    addViolation(filePath, '@db/core does not expose a default export')
  }

  const namedBindings = importClause.namedBindings
  if (!namedBindings) {
    return
  }

  if (ts.isNamespaceImport(namedBindings)) {
    addViolation(filePath, '@db/core namespace imports are not allowed')
    return
  }

  for (const specifier of namedBindings.elements) {
    const importedName = specifier.propertyName?.text ?? specifier.name.text

    if (!ALLOWED_CORE_EXPORTS.has(importedName)) {
      addViolation(
        filePath,
        `imports non-public @db/core symbol "${importedName}"`,
      )
    }
  }
}

function checkCoreExportDeclaration(
  filePath: string,
  node: ts.ExportDeclaration,
) {
  if (!node.exportClause) {
    addViolation(filePath, '@db/core broad re-exports are not allowed')
    return
  }

  if (!ts.isNamedExports(node.exportClause)) {
    addViolation(filePath, '@db/core namespace re-exports are not allowed')
    return
  }

  for (const specifier of node.exportClause.elements) {
    const exportedName = specifier.propertyName?.text ?? specifier.name.text

    if (!ALLOWED_CORE_EXPORTS.has(exportedName)) {
      addViolation(
        filePath,
        `re-exports non-public @db/core symbol "${exportedName}"`,
      )
    }
  }
}

function checkForbiddenDbAliasImports() {
  for (const filePath of TYPE_SCRIPT_FILES) {
    const sourceFile = getSourceFile(filePath)

    sourceFile.forEachChild((node) => {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) {
        return
      }

      const moduleSpecifier = getModuleSpecifier(node)
      if (!moduleSpecifier) {
        return
      }

      if (
        moduleSpecifier.startsWith('@db/core/') ||
        moduleSpecifier.startsWith('@db/schema/') ||
        moduleSpecifier === '@db/relations' ||
        moduleSpecifier.startsWith('@db/relations/')
      ) {
        addViolation(
          filePath,
          `references forbidden db alias "${moduleSpecifier}"`,
        )
      }
    })
  }
}

function checkRelativeSchemaImports() {
  for (const filePath of TYPE_SCRIPT_FILES) {
    if (isInsideRoot(filePath, DB_SCHEMA_ROOT)) {
      continue
    }

    const sourceFile = getSourceFile(filePath)

    sourceFile.forEachChild((node) => {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) {
        return
      }

      const moduleSpecifier = getModuleSpecifier(node)
      if (!moduleSpecifier || !moduleSpecifier.startsWith('.')) {
        return
      }

      if (resolvesInsideRoot(filePath, moduleSpecifier, DB_SCHEMA_ROOT)) {
        addViolation(
          filePath,
          `uses relative import into db/schema: "${moduleSpecifier}"`,
        )
      }
    })
  }
}

function checkRelativeRelationsImports() {
  for (const filePath of TYPE_SCRIPT_FILES) {
    if (isInsideDbCore(filePath)) {
      continue
    }

    const sourceFile = getSourceFile(filePath)

    sourceFile.forEachChild((node) => {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) {
        return
      }

      const moduleSpecifier = getModuleSpecifier(node)
      if (!moduleSpecifier || !moduleSpecifier.startsWith('.')) {
        return
      }

      if (resolvesInsideRoot(filePath, moduleSpecifier, DB_RELATIONS_ROOT)) {
        addViolation(
          filePath,
          `uses relative import into db/relations: "${moduleSpecifier}"`,
        )
      }
    })
  }
}

function checkNoDirectErrorInternalImports() {
  for (const filePath of TYPE_SCRIPT_FILES) {
    if (isInsideDbCore(filePath)) {
      continue
    }

    const sourceFile = getSourceFile(filePath)

    sourceFile.forEachChild((node) => {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) {
        return
      }

      const moduleSpecifier = getModuleSpecifier(node)
      if (!moduleSpecifier) {
        return
      }

      if (isDbCoreErrorInternalImport(filePath, moduleSpecifier)) {
        addViolation(
          filePath,
          `imports internal db/core error module "${moduleSpecifier}"`,
        )
      }
    })
  }
}

function checkPublicBarrel() {
  const sourceFile = getSourceFile(PUBLIC_BARREL_PATH)

  sourceFile.forEachChild((node) => {
    if (!ts.isExportDeclaration(node)) {
      return
    }

    const moduleSpecifier = getModuleSpecifier(node)

    if (!node.exportClause) {
      addViolation(
        PUBLIC_BARREL_PATH,
        `uses broad export from "${moduleSpecifier ?? '<unknown>'}"`,
      )
      return
    }

    if (moduleSpecifier === './drizzle.provider') {
      addViolation(PUBLIC_BARREL_PATH, 'exports provider internals')
    }

    if (!ts.isNamedExports(node.exportClause)) {
      return
    }

    for (const specifier of node.exportClause.elements) {
      const exportedName = specifier.name.text
      const sourceName = specifier.propertyName?.text ?? exportedName
      const allowedAliasedSourceName =
        ALLOWED_CORE_EXPORT_ALIASES.get(exportedName)

      if (FORBIDDEN_CORE_EXPORTS.has(sourceName)) {
        addViolation(
          PUBLIC_BARREL_PATH,
          `exports forbidden provider symbol "${sourceName}"`,
        )
      }

      if (
        !ALLOWED_CORE_EXPORTS.has(sourceName) &&
        allowedAliasedSourceName !== sourceName
      ) {
        addViolation(
          PUBLIC_BARREL_PATH,
          `exports non-allowlisted source symbol "${sourceName}"`,
        )
      }

      if (!ALLOWED_CORE_EXPORTS.has(exportedName)) {
        addViolation(
          PUBLIC_BARREL_PATH,
          `exports non-allowlisted public symbol "${exportedName}"`,
        )
      }
    }
  })
}

function listTypeScriptFiles(rootNames: string[]) {
  const files: string[] = []

  for (const rootName of rootNames) {
    const rootPath = resolve(WORKSPACE_ROOT, rootName)
    collectTypeScriptFiles(rootPath, files)
  }

  return files.sort((left, right) => left.localeCompare(right))
}

function collectTypeScriptFiles(directoryPath: string, files: string[]) {
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === 'coverage'
    ) {
      continue
    }

    const entryPath = join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      collectTypeScriptFiles(entryPath, files)
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entryPath)
    }
  }
}

function createSourceFile(filePath: string) {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
}

function getSourceFile(filePath: string) {
  const sourceFile = SOURCE_FILES.get(filePath)
  if (!sourceFile) {
    throw new Error(
      `Missing cached source file: ${relative(WORKSPACE_ROOT, filePath)}`,
    )
  }
  return sourceFile
}

function getModuleSpecifier(node: ts.ImportDeclaration | ts.ExportDeclaration) {
  const specifier = node.moduleSpecifier
  if (!specifier || !ts.isStringLiteral(specifier)) {
    return null
  }

  return specifier.text
}

function isInsideDbCore(filePath: string) {
  return isInsideRoot(filePath, DB_CORE_ROOT)
}

function isDbCoreErrorInternalImport(
  filePath: string,
  moduleSpecifier: string,
) {
  if (!moduleSpecifier.startsWith('.')) {
    return false
  }

  return resolvesInsideRoot(
    filePath,
    moduleSpecifier,
    resolve(DB_CORE_ROOT, 'error'),
  )
}

function resolvesInsideRoot(
  fromFilePath: string,
  moduleSpecifier: string,
  rootPath: string,
) {
  return isInsideRoot(resolve(fromFilePath, '..', moduleSpecifier), rootPath)
}

function isInsideRoot(filePath: string, rootPath: string) {
  const normalizedFilePath = normalizePath(filePath)
  const normalizedRootPath = normalizePath(rootPath)
  return (
    normalizedFilePath === normalizedRootPath ||
    normalizedFilePath.startsWith(`${normalizedRootPath}/`)
  )
}

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, '/')
}

function addViolation(filePath: string, message: string) {
  violations.push({
    filePath: relative(WORKSPACE_ROOT, filePath),
    message,
  })
}
