import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const WORKSPACE_ROOT = resolve(__dirname, '..')
const SCAN_ROOTS = ['.']
const FORBIDDEN_SWAGGER_IMPORT_PREFIX = '@nestjs/swagger/dist'
const SKIP_DIRECTORY_NAMES = new Set([
  '.git',
  '.history',
  '.omx',
  '.trae',
  'coverage',
  'dist',
  'node_modules',
])
const SCANNED_SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
])

interface BoundaryViolation {
  filePath: string
  message: string
}

const violations: BoundaryViolation[] = []
const TYPE_SCRIPT_FILES = listTypeScriptFiles(SCAN_ROOTS)
const SOURCE_FILES = new Map(
  TYPE_SCRIPT_FILES.map((filePath) => [filePath, createSourceFile(filePath)]),
)

checkSwaggerImports()

if (violations.length > 0) {
  console.error('@nestjs/swagger import boundary check failed:')

  for (const violation of violations) {
    console.error(`- ${violation.filePath}: ${violation.message}`)
  }

  process.exitCode = 1
} else {
  console.log('@nestjs/swagger import boundary check passed.')
}

function checkSwaggerImports() {
  for (const filePath of TYPE_SCRIPT_FILES) {
    const sourceFile = getSourceFile(filePath)

    visitNode(filePath, sourceFile)
  }
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
    const entryPath = join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      if (SKIP_DIRECTORY_NAMES.has(entry.name)) {
        continue
      }

      collectTypeScriptFiles(entryPath, files)
      continue
    }

    if (entry.isFile() && SCANNED_SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(entryPath)
    }
  }
}

function createSourceFile(filePath: string) {
  const scriptKind = resolveScriptKind(filePath)

  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
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

function visitNode(filePath: string, node: ts.Node) {
  const moduleSpecifier = getNodeModuleSpecifier(node)
  if (moduleSpecifier && isForbiddenSwaggerImport(moduleSpecifier)) {
    addViolation(
      filePath,
      `references private Swagger module "${moduleSpecifier}"; import from "@nestjs/swagger" instead`,
    )
  }

  ts.forEachChild(node, (child) => {
    visitNode(filePath, child)
  })
}

function getNodeModuleSpecifier(node: ts.Node) {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    return getDeclarationModuleSpecifier(node)
  }

  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference) &&
    node.moduleReference.expression &&
    ts.isStringLiteral(node.moduleReference.expression)
  ) {
    return node.moduleReference.expression.text
  }

  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    const literal = node.argument.literal
    if (ts.isStringLiteral(literal)) {
      return literal.text
    }
  }

  if (
    ts.isCallExpression(node) &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    if (
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require'
    ) {
      return node.arguments[0].text
    }

    if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      return node.arguments[0].text
    }
  }

  return null
}

function getDeclarationModuleSpecifier(
  node: ts.ImportDeclaration | ts.ExportDeclaration,
) {
  const specifier = node.moduleSpecifier
  if (!specifier || !ts.isStringLiteral(specifier)) {
    return null
  }

  return specifier.text
}

function isForbiddenSwaggerImport(moduleSpecifier: string) {
  return (
    moduleSpecifier === FORBIDDEN_SWAGGER_IMPORT_PREFIX ||
    moduleSpecifier.startsWith(`${FORBIDDEN_SWAGGER_IMPORT_PREFIX}/`)
  )
}

function resolveScriptKind(filePath: string) {
  switch (extname(filePath)) {
    case '.tsx':
      return ts.ScriptKind.TSX
    case '.jsx':
      return ts.ScriptKind.JSX
    case '.js':
    case '.cjs':
    case '.mjs':
      return ts.ScriptKind.JS
    default:
      return ts.ScriptKind.TS
  }
}

function addViolation(filePath: string, message: string) {
  violations.push({
    filePath: relative(WORKSPACE_ROOT, filePath),
    message,
  })
}
