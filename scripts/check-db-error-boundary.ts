import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const WORKSPACE_ROOT = process.cwd()
const SEARCH_ROOTS = ['apps', 'libs', 'db', 'scripts']
const OLD_DB_ERROR_SYMBOLS = new Set([
  'extractError',
  'getPostgresError',
  'handleError',
  'isCheckViolation',
  'isErrorCode',
  'isNotNullViolation',
  'isSerializationFailure',
  'isUniqueViolation',
])

interface BoundaryViolation {
  file: string
  line: number
  column: number
  message: string
}

const violations: BoundaryViolation[] = []

for (const root of SEARCH_ROOTS) {
  collectTypeScriptFiles(path.join(WORKSPACE_ROOT, root)).forEach(checkFile)
}

if (violations.length > 0) {
  console.error('DB error boundary check failed:')
  for (const violation of violations) {
    console.error(
      `${violation.file}:${violation.line}:${violation.column} - ${violation.message}`,
    )
  }
  process.exit(1)
}

console.log('DB error boundary check passed.')

function collectTypeScriptFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return []
  }

  const entries = fs.readdirSync(root, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue
      }
      files.push(...collectTypeScriptFiles(fullPath))
      continue
    }

    if (entry.isFile() && fullPath.endsWith('.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

function checkFile(filePath: string) {
  const normalizedPath = normalizePath(path.relative(WORKSPACE_ROOT, filePath))
  if (
    isAllowedDbCoreFile(normalizedPath) ||
    normalizedPath === normalizePath('scripts/check-db-error-boundary.ts')
  ) {
    return
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )

  visit(sourceFile, sourceFile, normalizedPath)
}

function visit(node: ts.Node, sourceFile: ts.SourceFile, filePath: string) {
  if (ts.isImportDeclaration(node)) {
    checkImport(node, sourceFile, filePath)
  }

  if (ts.isIdentifier(node) && OLD_DB_ERROR_SYMBOLS.has(node.text)) {
    addViolation(
      sourceFile,
      node,
      filePath,
      `old database error helper "${node.text}" is forbidden; use classifyError()/classifyPostgresError() facts instead`,
    )
  }

  if (ts.isIdentifier(node) && node.text === 'withTransactionConflictRetry') {
    addViolation(
      sourceFile,
      node,
      filePath,
      'private transaction retry wrapper is forbidden; use DrizzleService.withTransaction({ retry: { safeToRetry: true, ... } })',
    )
  }

  ts.forEachChild(node, (child) => visit(child, sourceFile, filePath))
}

function checkImport(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  filePath: string,
) {
  if (!ts.isStringLiteral(node.moduleSpecifier)) {
    return
  }

  const moduleName = node.moduleSpecifier.text
  if (isDbCoreErrorImport(moduleName)) {
    addViolation(
      sourceFile,
      node.moduleSpecifier,
      filePath,
      'direct db/core/error imports are forbidden outside db/core public owner files',
    )
  }

  if (
    moduleName === 'drizzle-orm' &&
    importsNamedSymbol(node, 'DrizzleQueryError')
  ) {
    addViolation(
      sourceFile,
      node.moduleSpecifier,
      filePath,
      'DrizzleQueryError imports are restricted to db/core',
    )
  }
}

function importsNamedSymbol(node: ts.ImportDeclaration, name: string): boolean {
  const clause = node.importClause
  if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
    return false
  }

  return clause.namedBindings.elements.some(
    (element) => element.name.text === name,
  )
}

function isDbCoreErrorImport(moduleName: string): boolean {
  return (
    moduleName === '@db/core/error' ||
    moduleName.startsWith('@db/core/error/') ||
    moduleName.includes('/db/core/error/') ||
    moduleName.includes('\\db\\core\\error\\')
  )
}

function isAllowedDbCoreFile(filePath: string): boolean {
  return filePath.startsWith('db/core/')
}

function addViolation(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  filePath: string,
  message: string,
) {
  const position = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  )
  violations.push({
    file: filePath,
    line: position.line + 1,
    column: position.character + 1,
    message,
  })
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/')
}
