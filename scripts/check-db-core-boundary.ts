import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const WORKSPACE_ROOT = resolve(__dirname, '..')
const SCAN_ROOTS = ['apps', 'libs', 'db', 'scripts']
const PUBLIC_BARREL_PATH = resolve(WORKSPACE_ROOT, 'db', 'core', 'index.ts')

const ALLOWED_CORE_EXPORTS = new Set([
  'Db',
  'DrizzleModule',
  'DrizzleErrorMessages',
  'DrizzleMutationResult',
  'DrizzleService',
  'PgTable',
  'PostgresError',
  'SQL',
  'SQLWrapper',
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

interface BoundaryViolation {
  filePath: string
  message: string
}

const violations: BoundaryViolation[] = []

checkCoreImports()
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
  for (const filePath of listTypeScriptFiles(SCAN_ROOTS)) {
    const sourceFile = createSourceFile(filePath)

    sourceFile.forEachChild((node) => {
      if (!ts.isImportDeclaration(node)) {
        return
      }

      if (getModuleSpecifier(node) !== '@db/core') {
        return
      }

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
    })
  }
}

function checkNoDirectErrorInternalImports() {
  for (const filePath of listTypeScriptFiles(SCAN_ROOTS)) {
    if (isInsideDbCore(filePath)) {
      continue
    }

    const sourceFile = createSourceFile(filePath)

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
  const sourceFile = createSourceFile(PUBLIC_BARREL_PATH)

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
      if (FORBIDDEN_CORE_EXPORTS.has(exportedName)) {
        addViolation(
          PUBLIC_BARREL_PATH,
          `exports forbidden provider symbol "${exportedName}"`,
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

function getModuleSpecifier(node: ts.ImportDeclaration | ts.ExportDeclaration) {
  const specifier = node.moduleSpecifier
  if (!specifier || !ts.isStringLiteral(specifier)) {
    return null
  }

  return specifier.text
}

function isInsideDbCore(filePath: string) {
  const relativePath = normalizePath(relative(WORKSPACE_ROOT, filePath))
  return (
    relativePath === 'db/core/index.ts' || relativePath.startsWith('db/core/')
  )
}

function isDbCoreErrorInternalImport(
  filePath: string,
  moduleSpecifier: string,
) {
  if (
    moduleSpecifier === '@db/core/error' ||
    moduleSpecifier.startsWith('@db/core/error/')
  ) {
    return true
  }

  if (!moduleSpecifier.startsWith('.')) {
    return false
  }

  const resolvedImportPath = normalizePath(
    resolve(filePath, '..', moduleSpecifier),
  )
  const errorInternalPath = normalizePath(
    resolve(WORKSPACE_ROOT, 'db', 'core', 'error'),
  )
  return (
    resolvedImportPath === errorInternalPath ||
    resolvedImportPath.startsWith(`${errorInternalPath}/`)
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
