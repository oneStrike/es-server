import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const ROOT = process.cwd()

const SKIPPED_DIRS = new Set([
  '.git',
  '.omx',
  'dist',
  'node_modules',
  'coverage',
])

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.json',
  '.jsonc',
  '.md',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
])

const RUNTIME_ROOTS = ['apps', 'libs', 'db', 'scripts']
const CONFIG_FILES = ['package.json', 'tsconfig.json', 'tsconfig.build.json']
const SELF = 'scripts/check-identity-hard-cut.ts'
const RETAINED_TEST_FILE_PATTERN =
  /(?:^|\/)(?:test\/.*|\S+\.(?:spec|test|e2e\.spec)\.ts)$/
const PROBE_FILE_PATTERN =
  /(?:^|\/)(?:probe|.*[.-]probe|probe[.-].*)\.(?:cjs|cts|js|mjs|mts|ts|tsx)$/
const CUT_GROUPS = new Set([
  'apps',
  'user',
  'platform',
  'db/core',
  'db/relations',
  'db/schema',
])

interface SourceFile {
  path: string
  text: string
}

const failures: string[] = []

function fail(message: string): void {
  failures.push(message)
}

function toRepoPath(targetPath: string): string {
  return relative(ROOT, targetPath).split(sep).join('/')
}

function extensionOf(targetPath: string): string {
  const match = targetPath.match(/\.[^.]+$/)
  return match?.[0] ?? ''
}

function hasSkippedSegment(repoPath: string): boolean {
  return repoPath.split('/').some((segment) => SKIPPED_DIRS.has(segment))
}

function collectFiles(targetPath: string, files: string[] = []): string[] {
  if (!existsSync(targetPath)) {
    return files
  }
  const stat = statSync(targetPath)
  if (stat.isDirectory()) {
    const name = targetPath.split(/[\\/]/).at(-1)
    if (name && SKIPPED_DIRS.has(name)) {
      return files
    }
    for (const entry of readdirSync(targetPath)) {
      collectFiles(join(targetPath, entry), files)
    }
    return files
  }
  if (stat.isFile() && TEXT_EXTENSIONS.has(extensionOf(targetPath))) {
    files.push(targetPath)
  }
  return files
}

function collectCommitCandidatePaths(): string[] {
  try {
    const output = execFileSync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    )
    return output
      .split('\0')
      .filter(Boolean)
      .filter((path) => !hasSkippedSegment(path))
      .map((path) => join(ROOT, path))
      .filter((path) => TEXT_EXTENSIONS.has(extensionOf(path)))
  } catch {
    return collectFiles(ROOT)
  }
}

function readSources(paths: string[]): SourceFile[] {
  return paths
    .filter((path) => existsSync(path))
    .map<SourceFile>((path) => ({
      path: toRepoPath(path),
      text: readFileSync(path, 'utf8'),
    }))
}

function collectRuntimeSources(): SourceFile[] {
  const paths = [
    ...RUNTIME_ROOTS.flatMap((root) => collectFiles(join(ROOT, root))),
    ...CONFIG_FILES.map((file) => join(ROOT, file)).filter((file) =>
      existsSync(file),
    ),
  ]
  return readSources(Array.from(new Set(paths)))
}

function collectCommitCandidateSources(): SourceFile[] {
  return readSources(Array.from(new Set(collectCommitCandidatePaths())))
}

function reportPattern(
  sources: SourceFile[],
  pattern: RegExp,
  message: string,
  allow?: (source: SourceFile, match: RegExpExecArray) => boolean,
): void {
  for (const source of sources) {
    for (const match of source.text.matchAll(pattern)) {
      if (allow?.(source, match)) {
        continue
      }
      fail(`${message}: ${source.path}`)
      break
    }
  }
}

function packageGroup(sourcePath: string): string | undefined {
  if (sourcePath.startsWith('apps/')) {
    return 'apps'
  }
  if (sourcePath.startsWith('db/core/')) {
    return 'db/core'
  }
  if (sourcePath.startsWith('db/relations/')) {
    return 'db/relations'
  }
  if (sourcePath.startsWith('db/schema/')) {
    return 'db/schema'
  }
  if (sourcePath.startsWith('libs/platform/')) {
    return 'platform'
  }
  if (sourcePath.startsWith('libs/user/')) {
    return 'user'
  }
  return undefined
}

function importedGroup(
  specifier: string,
  sourcePath: string,
): string | undefined {
  if (specifier === '@db/core') {
    return 'db/core'
  }
  if (specifier === '@db/schema') {
    return 'db/schema'
  }
  if (specifier.startsWith('@libs/platform/')) {
    return 'platform'
  }
  if (specifier.startsWith('@libs/user/')) {
    return 'user'
  }
  if (specifier.startsWith('.')) {
    const resolved = normalize(resolve(ROOT, dirname(sourcePath), specifier))
    const repoPath = toRepoPath(resolved)
    return packageGroup(repoPath)
  }
  return undefined
}

function importStatements(
  source: SourceFile,
): Array<{ names: string; specifier: string }> {
  const statements: Array<{ names: string; specifier: string }> = []
  let buffer = ''
  for (const line of source.text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (buffer === '' && !trimmed.startsWith('import ')) {
      continue
    }
    buffer = buffer ? `${buffer} ${trimmed}` : trimmed
    const specifier = buffer.match(/\bfrom ['"]([^'"]+)['"]/)?.[1]
    if (!specifier) {
      continue
    }
    statements.push({
      names: buffer.match(/\{([^}]+)\}/)?.[1] ?? '',
      specifier,
    })
    buffer = ''
  }
  return statements
}

function importSpecifiers(source: SourceFile): string[] {
  return importStatements(source).map((statement) => statement.specifier)
}

function checkFocusedBoundaryCycles(sources: SourceFile[]): void {
  const graph = new Map<string, Set<string>>()
  for (const group of CUT_GROUPS) {
    graph.set(group, new Set())
  }
  for (const source of sources) {
    if (!source.path.endsWith('.ts') && !source.path.endsWith('.tsx')) {
      continue
    }
    const fromGroup = packageGroup(source.path)
    if (!fromGroup || !CUT_GROUPS.has(fromGroup)) {
      continue
    }
    for (const specifier of importSpecifiers(source)) {
      const toGroup = importedGroup(specifier, source.path)
      if (toGroup && CUT_GROUPS.has(toGroup) && toGroup !== fromGroup) {
        graph.get(fromGroup)?.add(toGroup)
      }
    }
  }

  for (const [start, edges] of graph) {
    const stack = Array.from(edges)
    const seen = new Set<string>()
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current || seen.has(current)) {
        continue
      }
      if (current === start) {
        fail(`Forbidden app/user/platform/db SCC includes ${start}`)
        break
      }
      seen.add(current)
      for (const next of graph.get(current) ?? []) {
        stack.push(next)
      }
    }
  }
}

function checkAdminSystemRoleCodeOwner(sources: SourceFile[]): void {
  const declarations = sources
    .filter((source) =>
      /\b(?:enum|const|class|interface|type)\s+AdminSystemRoleCode\b/.test(
        source.text,
      ),
    )
    .map((source) => source.path)
  if (
    declarations.length !== 1 ||
    declarations[0] !== 'db/schema/admin/admin-rbac.ts'
  ) {
    fail(
      `AdminSystemRoleCode must have exactly one owner at db/schema/admin/admin-rbac.ts; found ${declarations.join(', ') || 'none'}`,
    )
  }
}

function checkOwnerImportAllowlist(sources: SourceFile[]): void {
  for (const source of sources) {
    if (!source.path.endsWith('.ts') && !source.path.endsWith('.tsx')) {
      continue
    }
    for (const { names, specifier } of importStatements(source)) {
      if (/\bAdminSystemRoleCode\b/.test(names) && specifier !== '@db/schema') {
        fail(
          `AdminSystemRoleCode imports are closed to @db/schema: ${source.path}`,
        )
      }
      if (
        /\bAppUserTokenStorageService\b/.test(names) &&
        specifier !== '@libs/user/token/app-user-token-storage.service' &&
        !(
          source.path.startsWith('libs/user/') &&
          specifier === './token/app-user-token-storage.service'
        )
      ) {
        fail(
          `AppUserTokenStorageService import must use the user owner path: ${source.path}`,
        )
      }
      if (
        /\bAdminUserTokenStorageService\b/.test(names) &&
        !(
          source.path.startsWith('apps/admin-api/') &&
          specifier.endsWith('/auth/token/admin-user-token-storage.service')
        ) &&
        specifier !== './token/admin-user-token-storage.service'
      ) {
        fail(
          `AdminUserTokenStorageService imports are closed to admin auth owner paths: ${source.path}`,
        )
      }
    }
  }
}

function checkPlatformAndDbCorePurity(sources: SourceFile[]): void {
  const checked = sources.filter(
    (source) =>
      source.path.startsWith('libs/platform/') ||
      source.path.startsWith('db/core/'),
  )
  reportPattern(
    checked,
    /from ['"](?:@libs\/user\/token\/|@libs\/user\/.*token|apps\/admin-api\/.*token)/g,
    'Platform/db-core must not import app token adapter owners',
  )
  reportPattern(
    checked,
    /\b(?:adminUserToken|appUserToken)\b/g,
    'Platform/db-core must not reference app token tables',
  )
}

function checkRetainedTests(sources: SourceFile[]): void {
  for (const source of sources) {
    if (RETAINED_TEST_FILE_PATTERN.test(source.path)) {
      fail(`Retained test file is forbidden: ${source.path}`)
      continue
    }
    if (source.path !== SELF && PROBE_FILE_PATTERN.test(source.path)) {
      fail(`Retained probe file is forbidden: ${source.path}`)
    }
  }
}

function propertyNameText(
  name: ts.PropertyName,
  sourceFile: ts.SourceFile,
): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text
  }
  return name.getText(sourceFile)
}

function moduleProviderArrays(
  source: SourceFile,
): Array<{ array: ts.ArrayLiteralExpression; sourceFile: ts.SourceFile }> {
  if (!source.path.endsWith('.module.ts')) {
    return []
  }

  const sourceFile = ts.createSourceFile(
    source.path,
    source.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const arrays: ts.ArrayLiteralExpression[] = []

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Module'
    ) {
      const metadata = node.arguments[0]
      if (metadata && ts.isObjectLiteralExpression(metadata)) {
        for (const property of metadata.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            propertyNameText(property.name, sourceFile) === 'providers' &&
            ts.isArrayLiteralExpression(property.initializer)
          ) {
            arrays.push(property.initializer)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return arrays.map((array) => ({ array, sourceFile }))
}

function isBareProvider(
  element: ts.Expression,
  name: string,
): element is ts.Identifier {
  return ts.isIdentifier(element) && element.text === name
}

function isTokenStorageBinding(
  element: ts.Expression,
  sourceFile: ts.SourceFile,
): boolean {
  if (!ts.isObjectLiteralExpression(element)) {
    return false
  }
  return element.properties.some(
    (property) =>
      ts.isPropertyAssignment(property) &&
      propertyNameText(property.name, sourceFile) === 'provide' &&
      ts.isIdentifier(property.initializer) &&
      property.initializer.text === 'TOKEN_STORAGE_SERVICE',
  )
}

function checkTokenProviderOwnership(sources: SourceFile[]): void {
  const moduleSources = sources.filter((source) =>
    source.path.endsWith('.module.ts'),
  )
  let tokenBindings = 0
  for (const source of moduleSources) {
    for (const { array, sourceFile } of moduleProviderArrays(source)) {
      if (
        array.elements.some((element) =>
          isBareProvider(element, 'AdminUserTokenStorageService'),
        ) &&
        source.path !== 'apps/admin-api/src/modules/auth/auth.module.ts'
      ) {
        fail(
          `Admin token storage provider registered outside admin auth owner: ${source.path}`,
        )
      }
      if (
        array.elements.some((element) =>
          isBareProvider(element, 'AppUserTokenStorageService'),
        ) &&
        source.path !== 'libs/user/src/user.module.ts'
      ) {
        fail(
          `App-user token storage provider registered outside user owner: ${source.path}`,
        )
      }
      tokenBindings += array.elements.filter((element) =>
        isTokenStorageBinding(element, sourceFile),
      ).length
    }
  }
  if (tokenBindings !== 2) {
    fail(
      `TOKEN_STORAGE_SERVICE must be bound exactly once per app auth module; found ${tokenBindings}`,
    )
  }
}

function main(): void {
  if (existsSync(join(ROOT, 'libs', 'identity'))) {
    fail('Forbidden directory exists: libs/identity')
  }
  if (existsSync(join(ROOT, 'db', 'schema', 'identity'))) {
    fail('Forbidden directory exists: db/schema/identity')
  }

  const sources = collectRuntimeSources()
  const commitCandidateSources = collectCommitCandidateSources()
  reportPattern(
    sources,
    /@libs\/identity|libs\/identity/g,
    'Forbidden identity path reference',
    (source) => source.path === SELF,
  )
  reportPattern(
    sources,
    /\b(?:IdentityModule|IdentityTokenStorageModule|identityRelations)\b/g,
    'Forbidden identity umbrella/module/relation symbol',
    (source) => source.path === SELF,
  )
  reportPattern(
    sources,
    /['"]ITokenStorageService['"]/g,
    'Forbidden string token usage',
  )
  reportPattern(
    sources,
    /BaseDrizzleTokenStorageService|drizzle-token-storage/g,
    'Forbidden DB-aware token storage base',
    (source) => source.path === SELF,
  )

  checkAdminSystemRoleCodeOwner(sources)
  checkOwnerImportAllowlist(sources)
  checkPlatformAndDbCorePurity(sources)
  checkTokenProviderOwnership(sources)
  checkFocusedBoundaryCycles(sources)
  checkRetainedTests(commitCandidateSources)

  if (failures.length > 0) {
    console.error('identity hard-cut check failed:')
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log('identity hard-cut check passed')
}

main()
