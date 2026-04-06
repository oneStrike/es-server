import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const root = process.cwd()

const workspacePrefixes = [
  `${root}${path.sep}apps${path.sep}`,
  `${root}${path.sep}libs${path.sep}`,
  `${root}${path.sep}db${path.sep}`,
  `${root}${path.sep}scripts${path.sep}`,
]

const BACKSLASH_PATTERN = /\\/g
const FORWARDING_FILE_PATTERN = /(?:\/index\.ts|\/module\.ts|\/base\.ts|\/contracts\.ts)$/

interface ModuleReference {
  line: number
  specifier: string
}

function toPosix(filePath: string) {
  return filePath.replace(BACKSLASH_PATTERN, '/')
}

function toWorkspacePath(absPath: string) {
  return toPosix(path.relative(root, absPath))
}

function isAllowedForwardingFile(absPath: string) {
  const rel = toWorkspacePath(absPath)
  return rel.startsWith('libs/platform/src/')
    && rel.endsWith('/index.ts')
    && !rel.includes('/test/')
    && rel !== 'libs/platform/src/index.ts'
    && rel !== 'libs/platform/src/module/index.ts'
    && rel !== 'libs/platform/src/modules/index.ts'
}

function isLibForwardingFile(absPath: string) {
  const rel = toWorkspacePath(absPath)
  return rel.startsWith('libs/')
    && FORWARDING_FILE_PATTERN.test(rel)
}

function isDisallowedForwardingFile(absPath: string) {
  return isLibForwardingFile(absPath) && !isAllowedForwardingFile(absPath)
}

function resolveModule(
  specifier: string,
  containingFile: string,
  config: ts.ParsedCommandLine,
) {
  const result = ts.resolveModuleName(
    specifier,
    containingFile,
    config.options,
    ts.sys,
  )
  return result.resolvedModule?.resolvedFileName ?? null
}

function getLine(sourceFile: ts.SourceFile, position: number) {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1
}

function isMockCallExpression(node: ts.CallExpression) {
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return false
  }

  const owner = node.expression.expression
  return ts.isIdentifier(owner)
    && (owner.text === 'jest' || owner.text === 'vi')
    && node.expression.name.text === 'mock'
}

function getStringArgument(node: ts.CallExpression) {
  const [firstArgument] = node.arguments
  if (!firstArgument || !ts.isStringLiteralLike(firstArgument)) {
    return null
  }
  return firstArgument
}

function collectModuleReferences(sourceFile: ts.SourceFile) {
  const references: ModuleReference[] = []

  const pushReference = (specifierNode: ts.StringLiteralLike) => {
    references.push({
      line: getLine(sourceFile, specifierNode.getStart(sourceFile)),
      specifier: specifierNode.text,
    })
  }

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      pushReference(node.moduleSpecifier)
    } else if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression)
        && node.expression.text === 'require'
      ) {
        const stringArgument = getStringArgument(node)
        if (stringArgument) {
          pushReference(stringArgument)
        }
      } else if (isMockCallExpression(node)) {
        const stringArgument = getStringArgument(node)
        if (stringArgument) {
          pushReference(stringArgument)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return references
}

async function collectWorkspaceFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, {
    withFileTypes: true,
  })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        return collectWorkspaceFiles(absPath)
      }
      return entry.isFile() ? [absPath] : []
    }),
  )
  return files.flat()
}

async function main() {
  const tsconfigPath = path.join(root, 'tsconfig.json')
  const tsconfigText = await fs.readFile(tsconfigPath, 'utf8')
  const tsconfigJson = ts.parseConfigFileTextToJson(tsconfigPath, tsconfigText)
  const config = ts.parseJsonConfigFileContent(tsconfigJson.config, ts.sys, root)

  const scanFiles = config.fileNames.filter((filePath) =>
    workspacePrefixes.some(prefix => filePath.startsWith(prefix)),
  )

  const importViolations: Array<{
    file: string
    line: number
    specifier: string
    resolved: string
  }> = []

  for (const filePath of scanFiles) {
    const text = await fs.readFile(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(
      filePath,
      text,
      ts.ScriptTarget.Latest,
      true,
    )
    const references = collectModuleReferences(sourceFile)

    for (const reference of references) {
      const resolved = resolveModule(reference.specifier, filePath, config)
      if (
        resolved
        && isLibForwardingFile(resolved)
        && !isAllowedForwardingFile(resolved)
      ) {
        importViolations.push({
          file: toWorkspacePath(filePath),
          line: reference.line,
          specifier: reference.specifier,
          resolved: toWorkspacePath(resolved),
        })
      }
    }
  }

  const libFiles = await collectWorkspaceFiles(path.join(root, 'libs'))
  const forwardingFiles = libFiles
    .filter(filePath => filePath.endsWith('.ts'))
    .filter(isDisallowedForwardingFile)
    .map(filePath => toWorkspacePath(filePath))
    .sort()

  if (importViolations.length === 0 && forwardingFiles.length === 0) {
    console.log('No disallowed barrel imports or forwarding files found.')
    return
  }

  if (importViolations.length > 0) {
    console.error('Found imports that resolve to forwarding files:')
    for (const violation of importViolations) {
      console.error(
        `- ${violation.file}:${violation.line} -> ${violation.specifier} (${violation.resolved})`,
      )
    }
  }

  if (forwardingFiles.length > 0) {
    console.error('Found forwarding files that must be removed:')
    for (const filePath of forwardingFiles) {
      console.error(`- ${filePath}`)
    }
  }

  console.error('Allowed platform public forwarders: libs/platform/src/**/index.ts (except root, module, modules, and test directories)')
  process.exit(1)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
