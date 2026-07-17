import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]s|[jt]sx)$/
const SKIPPED_DIRECTORIES = new Set(['.git', '.omx', 'dist', 'node_modules'])
const GLOBAL_INFRASTRUCTURE_ALLOWLIST = new Set([
  'libs/platform/src/modules/auth/auth.module.ts',
  'libs/platform/src/modules/crypto/crypto.module.ts',
  'libs/platform/src/modules/geo/geo.module.ts',
  'libs/platform/src/modules/logger/logger.module.ts',
])
const PLATFORM_PUBLIC_IMPORTS = new Set([
  '@libs/platform/bootstrap',
  '@libs/platform/config',
  '@libs/platform/constant',
  '@libs/platform/decorators',
  '@libs/platform/dto',
  '@libs/platform/exceptions',
  '@libs/platform/filters',
  '@libs/platform/types',
  '@libs/platform/utils',
  '@libs/platform/modules/auth/auth-cron.service',
  '@libs/platform/modules/auth/auth.guard',
  '@libs/platform/modules/auth/auth.module',
  '@libs/platform/modules/auth/auth.service',
  '@libs/platform/modules/auth/auth.strategy',
  '@libs/platform/modules/auth/base-token-storage.service',
  '@libs/platform/modules/auth/login-guard.service',
  '@libs/platform/modules/auth/dto',
  '@libs/platform/modules/auth/helpers',
  '@libs/platform/modules/auth/types',
  '@libs/platform/modules/captcha/captcha.service',
  '@libs/platform/modules/captcha/dto',
  '@libs/platform/modules/crypto/aes.service',
  '@libs/platform/modules/crypto/crypto.module',
  '@libs/platform/modules/crypto/rsa.service',
  '@libs/platform/modules/crypto/scrypt.service',
  '@libs/platform/modules/geo/dto',
  '@libs/platform/modules/geo/geo.module',
  '@libs/platform/modules/geo/geo.service',
  '@libs/platform/modules/geo/geo.type',
  '@libs/platform/modules/logger/logger.module',
  '@libs/platform/modules/logger/logger.service',
  '@libs/platform/modules/logger/logger.type',
  '@libs/platform/modules/sms/dto',
  '@libs/platform/modules/sms/sms.constant',
  '@libs/platform/modules/sms/sms.module',
  '@libs/platform/modules/sms/sms.service',
  '@libs/platform/modules/sms/sms.type',
  '@libs/platform/modules/upload/dto',
  '@libs/platform/modules/upload/upload.constant',
  '@libs/platform/modules/upload/upload.module',
  '@libs/platform/modules/upload/upload.service',
  '@libs/platform/modules/upload/upload.type',
])
const DB_PUBLIC_IMPORTS = new Set(['@db/core', '@db/schema'])
const LIBRARY_ALIASES = new Map([
  ['account', 'account'],
  ['app-config', 'config'],
  ['app-content', 'app-content'],
  ['config', 'config'],
  ['content', 'content'],
  ['dictionary', 'config'],
  ['eventing', 'eventing'],
  ['forum', 'forum'],
  ['growth', 'growth'],
  ['identity', 'identity'],
  ['interaction', 'interaction'],
  ['message', 'message'],
  ['observability', 'observability'],
  ['platform', 'platform'],
  ['sensitive-word', 'moderation'],
  ['system-config', 'config'],
  ['user', 'user'],
  ['workflow', 'workflow'],
])
const PACKAGE_RANKS = new Map([
  ['apps', 0],
  ['operational-cli', 0],
  ['account', 1],
  ['message', 2],
  ['content', 3],
  ['app-content', 3],
  ['forum', 4],
  ['commerce', 5],
  ['interaction', 6],
  ['growth', 7],
  ['moderation', 8],
  ['user', 9],
  ['identity', 9],
  ['config', 10],
  ['eventing', 11],
  ['workflow', 11],
  ['observability', 12],
  ['db/core', 13],
  ['db/relations', 14],
  ['db/schema', 15],
  ['platform', 16],
])

interface ArchitectureViolation {
  column: number
  filePath: string
  line: number
  message: string
}

interface PackageOwner {
  id: string
  rank: number
}

interface RuntimeImport {
  moduleName: string
  node: ts.Node
}

interface RuntimeEdge {
  from: string
  location: ArchitectureViolation
  to: string
}

interface ProviderRegistration {
  location: ArchitectureViolation
  moduleOwner: string
}

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
    if (
      entry.isFile() &&
      SOURCE_FILE_PATTERN.test(entry.name) &&
      !entry.name.endsWith('.d.ts')
    ) {
      files.push(entryPath)
    }
  }
  return files
}

function readCompilerOptions(root: string) {
  const configPath = join(root, 'tsconfig.json')
  const configResult = ts.readConfigFile(configPath, (fileName) =>
    ts.sys.readFile(fileName),
  )
  if (configResult.error !== undefined) {
    throw new Error(
      ts.flattenDiagnosticMessageText(configResult.error.messageText, '\n'),
    )
  }

  return ts.parseJsonConfigFileContent(
    configResult.config,
    ts.sys,
    root,
    undefined,
    configPath,
  ).options
}

function getLocation(
  root: string,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  message: string,
): ArchitectureViolation {
  const position = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  )
  return {
    column: position.character + 1,
    filePath: toRepoPath(root, sourceFile.fileName),
    line: position.line + 1,
    message,
  }
}

function formatLocation(location: ArchitectureViolation) {
  return `${location.filePath}:${location.line}:${location.column}`
}

function isRuntimeImportDeclaration(node: ts.ImportDeclaration) {
  const { importClause } = node
  if (importClause === undefined || importClause.isTypeOnly) {
    return importClause === undefined
  }
  if (importClause.name !== undefined) {
    return true
  }
  const bindings = importClause.namedBindings
  if (bindings === undefined || ts.isNamespaceImport(bindings)) {
    return true
  }
  return bindings.elements.some((element) => !element.isTypeOnly)
}

function isRuntimeExportDeclaration(node: ts.ExportDeclaration) {
  if (node.moduleSpecifier === undefined || node.isTypeOnly) {
    return false
  }
  if (
    node.exportClause === undefined ||
    ts.isNamespaceExport(node.exportClause)
  ) {
    return true
  }
  return node.exportClause.elements.some((element) => !element.isTypeOnly)
}

function collectRuntimeImports(sourceFile: ts.SourceFile): RuntimeImport[] {
  const imports: RuntimeImport[] = []
  const addModuleSpecifier = (node: ts.Node, moduleName: string) => {
    imports.push({ moduleName, node })
  }

  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      isRuntimeImportDeclaration(node)
    ) {
      addModuleSpecifier(node.moduleSpecifier, node.moduleSpecifier.text)
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      isRuntimeExportDeclaration(node)
    ) {
      addModuleSpecifier(node.moduleSpecifier, node.moduleSpecifier.text)
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression !== undefined &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      addModuleSpecifier(
        node.moduleReference.expression,
        node.moduleReference.expression.text,
      )
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        addModuleSpecifier(node.arguments[0], node.arguments[0].text)
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require'
      ) {
        addModuleSpecifier(node.arguments[0], node.arguments[0].text)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return imports
}

function getPackageOwnerFromRepoPath(
  relativePath: string,
): PackageOwner | undefined {
  const segments = relativePath.split('/')
  if (segments[0] === 'apps' && segments.length > 1) {
    return { id: 'apps', rank: 0 }
  }
  if (segments[0] === 'scripts') {
    return { id: 'operational-cli', rank: 0 }
  }
  if (segments[0] === 'libs' && segments.length > 1) {
    const library = segments[1] === 'moderation' ? 'moderation' : segments[1]
    const rank = PACKAGE_RANKS.get(library)
    return rank === undefined ? undefined : { id: library, rank }
  }
  if (segments[0] !== 'db') {
    return undefined
  }

  const dbOwner = segments[1]
  if (dbOwner === 'core' || dbOwner === 'relations' || dbOwner === 'schema') {
    const id = `db/${dbOwner}`
    return { id, rank: PACKAGE_RANKS.get(id) as number }
  }
  if (dbOwner === 'bootstrap' || dbOwner === 'seed' || dbOwner === 'targets') {
    return { id: 'operational-cli', rank: 0 }
  }
  if (dbOwner === 'comments' || dbOwner === 'migration') {
    return { id: 'operational-cli', rank: 0 }
  }
  if (dbOwner === undefined || dbOwner.endsWith('.ts')) {
    return { id: 'operational-cli', rank: 0 }
  }
  return undefined
}

function getPackageOwnerFromAlias(
  moduleName: string,
): PackageOwner | undefined {
  if (moduleName === '@db/core' || moduleName.startsWith('@db/core/')) {
    return { id: 'db/core', rank: 13 }
  }
  if (moduleName === '@db/schema' || moduleName.startsWith('@db/schema/')) {
    return { id: 'db/schema', rank: 15 }
  }
  if (
    moduleName === '@db/relations' ||
    moduleName.startsWith('@db/relations/')
  ) {
    return { id: 'db/relations', rank: 14 }
  }
  if (!moduleName.startsWith('@libs/')) {
    return undefined
  }

  const alias = moduleName.split('/')[2]
  const owner = alias === undefined ? undefined : LIBRARY_ALIASES.get(alias)
  const rank = owner === undefined ? undefined : PACKAGE_RANKS.get(owner)
  return owner === undefined || rank === undefined
    ? undefined
    : { id: owner, rank }
}

function resolveModule(
  moduleName: string,
  sourceFilePath: string,
  compilerOptions: ts.CompilerOptions,
  resolutionCache: ts.ModuleResolutionCache,
) {
  return ts.resolveModuleName(
    moduleName,
    sourceFilePath,
    compilerOptions,
    ts.sys,
    resolutionCache,
  ).resolvedModule?.resolvedFileName
}

function hasAllowedPublicEntry(moduleName: string) {
  return (
    PLATFORM_PUBLIC_IMPORTS.has(moduleName) || DB_PUBLIC_IMPORTS.has(moduleName)
  )
}

function isForwardingOnlyFile(resolvedFileName: string) {
  const sourceFile = ts.createSourceFile(
    resolvedFileName,
    readFileSync(resolvedFileName, 'utf8'),
    ts.ScriptTarget.ESNext,
    true,
  )
  return (
    sourceFile.statements.length > 0 &&
    sourceFile.statements.every(
      (statement) =>
        ts.isImportDeclaration(statement) ||
        ts.isExportDeclaration(statement) ||
        ts.isEmptyStatement(statement),
    )
  )
}

function isForbiddenBarrel(
  moduleName: string,
  resolvedFileName: string | undefined,
  sourceOwner: PackageOwner,
  sourceFileName: string,
  root: string,
) {
  if (
    (!moduleName.startsWith('.') &&
      !moduleName.startsWith('@libs/') &&
      !moduleName.startsWith('@db/')) ||
    hasAllowedPublicEntry(moduleName) ||
    resolvedFileName === undefined ||
    sourceOwner.id === 'operational-cli'
  ) {
    return false
  }
  const fileName = basename(resolvedFileName)
  const sourceRelativePath = toRepoPath(root, sourceFileName)
  const targetRelativePath = toRepoPath(root, resolvedFileName)
  if (
    sourceRelativePath.startsWith('libs/platform/src/') &&
    targetRelativePath.startsWith('libs/platform/src/') &&
    fileName.startsWith('index.')
  ) {
    return false
  }
  if (fileName.startsWith('index.')) {
    return true
  }
  return (
    /^(?:module|contracts|base|types?)\.[cm]?[jt]s$/.test(fileName) &&
    isForwardingOnlyFile(resolvedFileName)
  )
}

function getImportBindings(sourceFile: ts.SourceFile) {
  const bindings = new Map<
    string,
    { importedName: string; moduleName: string }
  >()
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.importClause === undefined
    ) {
      continue
    }
    const moduleName = statement.moduleSpecifier.text
    const { importClause } = statement
    if (importClause.name !== undefined) {
      bindings.set(importClause.name.text, {
        importedName: 'default',
        moduleName,
      })
    }
    if (importClause.namedBindings === undefined) {
      continue
    }
    if (ts.isNamespaceImport(importClause.namedBindings)) {
      bindings.set(importClause.namedBindings.name.text, {
        importedName: '*',
        moduleName,
      })
      continue
    }
    for (const element of importClause.namedBindings.elements) {
      bindings.set(element.name.text, {
        importedName: (element.propertyName ?? element.name).text,
        moduleName,
      })
    }
  }
  return bindings
}

function isDecoratorNamed(decorator: ts.Decorator, name: string) {
  return (
    ts.isCallExpression(decorator.expression) &&
    ts.isIdentifier(decorator.expression.expression) &&
    decorator.expression.expression.text === name
  )
}

function getObjectProperty(
  objectLiteral: ts.ObjectLiteralExpression,
  name: string,
) {
  return objectLiteral.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === name,
  )
}

function getModuleOwner(classDeclaration: ts.ClassDeclaration) {
  return classDeclaration.name?.text ?? '<anonymous-module>'
}

function getProviderToken(
  root: string,
  sourceFile: ts.SourceFile,
  node: ts.Expression,
  importBindings: Map<string, { importedName: string; moduleName: string }>,
  compilerOptions: ts.CompilerOptions,
  resolutionCache: ts.ModuleResolutionCache,
) {
  if (ts.isStringLiteral(node)) {
    return `string:${node.text}`
  }
  if (!ts.isIdentifier(node)) {
    return undefined
  }
  const binding = importBindings.get(node.text)
  if (binding?.moduleName.startsWith('@nestjs/')) {
    return undefined
  }
  if (binding === undefined) {
    return `class:${toRepoPath(root, sourceFile.fileName)}#${node.text}`
  }
  const resolvedFileName = resolveModule(
    binding.moduleName,
    sourceFile.fileName,
    compilerOptions,
    resolutionCache,
  )
  const source =
    resolvedFileName === undefined
      ? binding.moduleName
      : toRepoPath(root, resolvedFileName)
  return `class:${source}#${binding.importedName}`
}

function collectProviderRegistrations(
  root: string,
  sourceFile: ts.SourceFile,
  compilerOptions: ts.CompilerOptions,
  resolutionCache: ts.ModuleResolutionCache,
  providers: Map<string, ProviderRegistration[]>,
) {
  const importBindings = getImportBindings(sourceFile)
  const addProvider = (moduleOwner: string, provider: ts.Expression) => {
    let tokenExpression: ts.Expression | undefined
    if (ts.isIdentifier(provider) || ts.isStringLiteral(provider)) {
      tokenExpression = provider
    } else if (ts.isObjectLiteralExpression(provider)) {
      tokenExpression = getObjectProperty(provider, 'provide')?.initializer
    }
    if (tokenExpression === undefined) {
      return
    }
    const token = getProviderToken(
      root,
      sourceFile,
      tokenExpression,
      importBindings,
      compilerOptions,
      resolutionCache,
    )
    if (token === undefined) {
      return
    }
    const registrations = providers.get(token) ?? []
    registrations.push({
      location: getLocation(
        root,
        sourceFile,
        tokenExpression,
        `provider ${token} is registered here`,
      ),
      moduleOwner,
    })
    providers.set(token, registrations)
  }

  for (const statement of sourceFile.statements) {
    if (!ts.isClassDeclaration(statement)) {
      continue
    }
    const moduleDecorator = ts
      .getDecorators(statement)
      ?.find((decorator) => isDecoratorNamed(decorator, 'Module'))
    if (
      moduleDecorator === undefined ||
      !ts.isCallExpression(moduleDecorator.expression) ||
      moduleDecorator.expression.arguments.length === 0 ||
      !ts.isObjectLiteralExpression(moduleDecorator.expression.arguments[0])
    ) {
      continue
    }
    const providersProperty = getObjectProperty(
      moduleDecorator.expression.arguments[0],
      'providers',
    )
    if (
      providersProperty === undefined ||
      !ts.isArrayLiteralExpression(providersProperty.initializer)
    ) {
      continue
    }
    for (const provider of providersProperty.initializer.elements) {
      if (ts.isExpression(provider)) {
        addProvider(getModuleOwner(statement), provider)
      }
    }
  }
}

function collectSyntaxViolations(
  root: string,
  sourceFile: ts.SourceFile,
  violations: ArchitectureViolation[],
) {
  const relativePath = toRepoPath(root, sourceFile.fileName)
  const importBindings = getImportBindings(sourceFile)
  const moduleRefIdentifiers = new Set(
    [...importBindings.entries()]
      .filter(([, binding]) => binding.moduleName === '@nestjs/core')
      .filter(([, binding]) => binding.importedName === 'ModuleRef')
      .map(([identifier]) => identifier),
  )
  const moduleRefPropertyNames = new Set<string>()
  const visitModuleRefProperties = (node: ts.Node): void => {
    if (ts.isConstructorDeclaration(node)) {
      for (const parameter of node.parameters) {
        if (
          ts.isIdentifier(parameter.name) &&
          parameter.type !== undefined &&
          ts.isTypeReferenceNode(parameter.type) &&
          ts.isIdentifier(parameter.type.typeName) &&
          moduleRefIdentifiers.has(parameter.type.typeName.text)
        ) {
          moduleRefPropertyNames.add(parameter.name.text)
        }
      }
    }
    ts.forEachChild(node, visitModuleRefProperties)
  }
  visitModuleRefProperties(sourceFile)
  const isModuleRefReceiver = (expression: ts.Expression) => {
    if (ts.isIdentifier(expression)) {
      return moduleRefIdentifiers.has(expression.text)
    }
    return (
      ts.isPropertyAccessExpression(expression) &&
      expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
      moduleRefPropertyNames.has(expression.name.text)
    )
  }
  const isModuleRefLookupCall = (node: ts.CallExpression) =>
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'get' &&
    isModuleRefReceiver(node.expression.expression)

  const visit = (node: ts.Node): void => {
    if (ts.isDecorator(node) && isDecoratorNamed(node, 'Global')) {
      if (!GLOBAL_INFRASTRUCTURE_ALLOWLIST.has(relativePath)) {
        violations.push(
          getLocation(
            root,
            sourceFile,
            node,
            '@Global() is forbidden outside the infrastructure allowlist; make the owner module explicit',
          ),
        )
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'forwardRef'
    ) {
      violations.push(
        getLocation(
          root,
          sourceFile,
          node.expression,
          'forwardRef() is forbidden; remove the reverse runtime edge instead',
        ),
      )
    }
    if (
      ts.isCallExpression(node) &&
      isModuleRefLookupCall(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      violations.push(
        getLocation(
          root,
          sourceFile,
          node.arguments[0],
          'string-token service lookup is forbidden; inject an explicit owner provider',
        ),
      )
    }
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'strict' &&
      node.initializer.kind === ts.SyntaxKind.FalseKeyword &&
      ts.isObjectLiteralExpression(node.parent) &&
      ts.isCallExpression(node.parent.parent) &&
      isModuleRefLookupCall(node.parent.parent)
    ) {
      violations.push(
        getLocation(
          root,
          sourceFile,
          node,
          'strict: false is forbidden because it bypasses the owner module boundary',
        ),
      )
    }
    ts.forEachChild(node, visit)
  }

  for (const identifier of moduleRefIdentifiers) {
    const binding = [...sourceFile.statements].find(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        statement.importClause !== undefined &&
        statement.importClause.getText(sourceFile).includes(identifier),
    )
    if (binding !== undefined) {
      violations.push(
        getLocation(
          root,
          sourceFile,
          binding,
          'ModuleRef service lookup is forbidden; inject the explicit owner provider',
        ),
      )
    }
  }
  visit(sourceFile)
}

function collectPackageAndImportViolations(
  root: string,
  sourceFile: ts.SourceFile,
  compilerOptions: ts.CompilerOptions,
  resolutionCache: ts.ModuleResolutionCache,
  violations: ArchitectureViolation[],
  edges: RuntimeEdge[],
) {
  const sourceOwner = getPackageOwnerFromRepoPath(
    toRepoPath(root, sourceFile.fileName),
  )
  if (sourceOwner === undefined) {
    violations.push(
      getLocation(
        root,
        sourceFile,
        sourceFile,
        'runtime source package is not registered in the 09 package DAG',
      ),
    )
    return
  }

  for (const runtimeImport of collectRuntimeImports(sourceFile)) {
    const resolvedFileName = resolveModule(
      runtimeImport.moduleName,
      sourceFile.fileName,
      compilerOptions,
      resolutionCache,
    )
    if (
      isForbiddenBarrel(
        runtimeImport.moduleName,
        resolvedFileName,
        sourceOwner,
        sourceFile.fileName,
        root,
      )
    ) {
      violations.push(
        getLocation(
          root,
          sourceFile,
          runtimeImport.node,
          `forbidden runtime barrel import ${runtimeImport.moduleName}; import the concrete owner file instead`,
        ),
      )
    }

    const targetOwner =
      (resolvedFileName === undefined
        ? undefined
        : getPackageOwnerFromRepoPath(toRepoPath(root, resolvedFileName))) ??
      getPackageOwnerFromAlias(runtimeImport.moduleName)
    if (targetOwner === undefined) {
      if (runtimeImport.moduleName.startsWith('@libs/')) {
        violations.push(
          getLocation(
            root,
            sourceFile,
            runtimeImport.node,
            `runtime @libs import ${runtimeImport.moduleName} has no registered 09 package owner`,
          ),
        )
      }
      continue
    }
    if (sourceOwner.id === targetOwner.id) {
      continue
    }

    const location = getLocation(
      root,
      sourceFile,
      runtimeImport.node,
      `runtime package edge ${sourceOwner.id} -> ${targetOwner.id}`,
    )
    edges.push({ from: sourceOwner.id, location, to: targetOwner.id })
    if (sourceOwner.rank > targetOwner.rank) {
      violations.push({
        ...location,
        message: `runtime import ${runtimeImport.moduleName} reverses the 09 DAG (${sourceOwner.id} -> ${targetOwner.id})`,
      })
    }
  }
}

function collectProviderDuplicateViolations(
  providers: Map<string, ProviderRegistration[]>,
) {
  const violations: ArchitectureViolation[] = []
  for (const [token, registrations] of providers) {
    if (registrations.length < 2) {
      continue
    }
    for (const registration of registrations) {
      const peer = registrations.find((candidate) => candidate !== registration)
      if (peer !== undefined) {
        violations.push({
          ...registration.location,
          message: `duplicate provider ${token}; its other owner registration is ${peer.moduleOwner} at ${formatLocation(peer.location)}`,
        })
      }
    }
  }
  return violations
}

function collectSccViolations(edges: RuntimeEdge[]) {
  const adjacency = new Map<string, RuntimeEdge[]>()
  for (const edge of edges) {
    const outgoing = adjacency.get(edge.from) ?? []
    if (!outgoing.some((candidate) => candidate.to === edge.to)) {
      outgoing.push(edge)
      adjacency.set(edge.from, outgoing)
    }
    if (!adjacency.has(edge.to)) {
      adjacency.set(edge.to, [])
    }
  }

  let index = 0
  const indices = new Map<string, number>()
  const lowLinks = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const violations: ArchitectureViolation[] = []
  const visit = (node: string): void => {
    indices.set(node, index)
    lowLinks.set(node, index)
    index += 1
    stack.push(node)
    onStack.add(node)

    for (const edge of adjacency.get(node) ?? []) {
      if (!indices.has(edge.to)) {
        visit(edge.to)
        lowLinks.set(
          node,
          Math.min(
            lowLinks.get(node) as number,
            lowLinks.get(edge.to) as number,
          ),
        )
      } else if (onStack.has(edge.to)) {
        lowLinks.set(
          node,
          Math.min(
            lowLinks.get(node) as number,
            indices.get(edge.to) as number,
          ),
        )
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) {
      return
    }
    const component: string[] = []
    let member: string | undefined
    do {
      member = stack.pop()
      if (member !== undefined) {
        onStack.delete(member)
        component.push(member)
      }
    } while (member !== node)
    if (component.length < 2) {
      return
    }

    const members = new Set(component)
    const evidence = edges.find(
      (edge) => members.has(edge.from) && members.has(edge.to),
    )
    if (evidence !== undefined) {
      violations.push({
        ...evidence.location,
        message: `runtime package SCC detected among ${component.sort().join(', ')}; remove the reverse edge, do not use forwardRef()`,
      })
    }
  }

  for (const node of [...adjacency.keys()].sort()) {
    if (!indices.has(node)) {
      visit(node)
    }
  }
  return violations
}

interface SourceExpression {
  expression: ts.Expression
  sourceFile: ts.SourceFile
}

interface ModuleMetadataDefinition {
  controllers?: SourceExpression
  exports?: SourceExpression
  imports?: SourceExpression
  providers?: SourceExpression
}

interface ModuleDefinition {
  classDeclaration: ts.ClassDeclaration
  className: string
  dynamicFactories: Map<string, DynamicFactoryDefinition>
  id: string
  isGlobal: boolean
  metadata: ModuleMetadataDefinition
  sourceFile: ts.SourceFile
}

interface DynamicFactoryDefinition {
  classDefinition: ModuleDefinition
  id: string
  method: ts.MethodDeclaration
  name: string
}

interface EvaluatedValue {
  classDefinition?: ModuleDefinition
  dynamicFactory?: DynamicFactoryDefinition
  kind:
    | 'array'
    | 'dynamic'
    | 'external'
    | 'module'
    | 'object'
    | 'primitive'
    | 'symbol'
    | 'unknown'
  node: ts.Node
  properties?: Map<string, EvaluatedValue>
  sourceFile: ts.SourceFile
  value?: boolean | null | number | string | undefined
  values?: EvaluatedValue[]
}

interface EvaluationContext {
  classDefinition?: ModuleDefinition
  environment: Map<string, EvaluatedValue>
  sourceFile: ts.SourceFile
}

interface DynamicModuleMetadata {
  controllers: EvaluatedValue[]
  exports: EvaluatedValue[]
  imports: EvaluatedValue[]
  isGlobal: boolean
  moduleDefinition: ModuleDefinition
  providers: EvaluatedValue[]
}

interface CompositionModuleInstance {
  controllers: EvaluatedValue[]
  exports: EvaluatedValue[]
  id: string
  imports: EvaluatedValue[]
  isGlobal: boolean
  label: string
  location: ArchitectureViolation
  moduleDefinition: ModuleDefinition
  providers: EvaluatedValue[]
}

interface CompositionEdge {
  from: string
  location: ArchitectureViolation
  to: string
}

interface NestModuleModel {
  byFileAndClassName: Map<string, ModuleDefinition>
  compilerOptions: ts.CompilerOptions
  dynamicFactoryInvocations: Set<string>
  moduleDefinitions: ModuleDefinition[]
  resolutionCache: ts.ModuleResolutionCache
  root: string
  sourceFilesByPath: Map<string, ts.SourceFile>
  violations: ArchitectureViolation[]
}

function sourceFileKey(filePath: string) {
  return resolve(filePath).replaceAll('\\', '/').toLowerCase()
}

function moduleDefinitionKey(sourceFile: ts.SourceFile, className: string) {
  return `${sourceFileKey(sourceFile.fileName)}#${className}`
}

function getModuleMetadataDefinition(
  sourceFile: ts.SourceFile,
  classDeclaration: ts.ClassDeclaration,
) {
  const decorator = ts
    .getDecorators(classDeclaration)
    ?.find((candidate) => isDecoratorNamed(candidate, 'Module'))
  if (
    decorator === undefined ||
    !ts.isCallExpression(decorator.expression) ||
    decorator.expression.arguments.length !== 1 ||
    !ts.isObjectLiteralExpression(decorator.expression.arguments[0])
  ) {
    return undefined
  }

  const metadata = decorator.expression.arguments[0]
  const getPropertyExpression = (name: string) =>
    getObjectProperty(metadata, name)?.initializer
  const toSourceExpression = (expression: ts.Expression | undefined) =>
    expression === undefined ? undefined : { expression, sourceFile }

  return {
    controllers: toSourceExpression(getPropertyExpression('controllers')),
    exports: toSourceExpression(getPropertyExpression('exports')),
    imports: toSourceExpression(getPropertyExpression('imports')),
    providers: toSourceExpression(getPropertyExpression('providers')),
  } satisfies ModuleMetadataDefinition
}

function hasStaticModifier(method: ts.MethodDeclaration) {
  return method.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword,
  )
}

function isDynamicModuleReturnType(
  sourceFile: ts.SourceFile,
  type: ts.TypeNode | undefined,
) {
  if (type === undefined) {
    return false
  }
  return /(?:^|\.)DynamicModule$/.test(type.getText(sourceFile).trim())
}

function createNestModuleModel(
  root: string,
  sourceFiles: ts.SourceFile[],
  compilerOptions: ts.CompilerOptions,
  resolutionCache: ts.ModuleResolutionCache,
  violations: ArchitectureViolation[],
) {
  const moduleDefinitions: ModuleDefinition[] = []
  const byFileAndClassName = new Map<string, ModuleDefinition>()
  const sourceFilesByPath = new Map(
    sourceFiles.map((sourceFile) => [
      sourceFileKey(sourceFile.fileName),
      sourceFile,
    ]),
  )

  for (const sourceFile of sourceFiles) {
    for (const statement of sourceFile.statements) {
      if (!ts.isClassDeclaration(statement) || statement.name === undefined) {
        continue
      }
      const metadata = getModuleMetadataDefinition(sourceFile, statement)
      if (metadata === undefined) {
        continue
      }
      const definition: ModuleDefinition = {
        classDeclaration: statement,
        className: statement.name.text,
        dynamicFactories: new Map(),
        id: `${toRepoPath(root, sourceFile.fileName)}#${statement.name.text}`,
        isGlobal:
          ts
            .getDecorators(statement)
            ?.some((decorator) => isDecoratorNamed(decorator, 'Global')) ??
          false,
        metadata,
        sourceFile,
      }
      moduleDefinitions.push(definition)
      byFileAndClassName.set(
        moduleDefinitionKey(sourceFile, statement.name.text),
        definition,
      )
    }
  }

  for (const definition of moduleDefinitions) {
    for (const member of definition.classDeclaration.members) {
      if (
        !ts.isMethodDeclaration(member) ||
        member.name === undefined ||
        !hasStaticModifier(member) ||
        !isDynamicModuleReturnType(definition.sourceFile, member.type)
      ) {
        continue
      }
      const name = member.name.getText(definition.sourceFile)
      definition.dynamicFactories.set(name, {
        classDefinition: definition,
        id: `${definition.id}.${name}`,
        method: member,
        name,
      })
    }
  }

  return {
    byFileAndClassName,
    compilerOptions,
    dynamicFactoryInvocations: new Set<string>(),
    moduleDefinitions,
    resolutionCache,
    root,
    sourceFilesByPath,
    violations,
  } satisfies NestModuleModel
}

function addModelViolation(
  model: NestModuleModel,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  message: string,
) {
  model.violations.push(getLocation(model.root, sourceFile, node, message))
}

function getResolvedSourceFile(
  model: NestModuleModel,
  sourceFile: ts.SourceFile,
  moduleName: string,
) {
  const resolved = resolveModule(
    moduleName,
    sourceFile.fileName,
    model.compilerOptions,
    model.resolutionCache,
  )
  return resolved === undefined
    ? undefined
    : model.sourceFilesByPath.get(sourceFileKey(resolved))
}

function resolveExportedModuleDefinition(
  model: NestModuleModel,
  sourceFile: ts.SourceFile,
  exportName: string,
  visited = new Set<string>(),
): ModuleDefinition | undefined {
  const lookupKey = moduleDefinitionKey(sourceFile, exportName)
  const direct = model.byFileAndClassName.get(lookupKey)
  if (direct !== undefined) {
    return direct
  }
  const visitKey = `${sourceFileKey(sourceFile.fileName)}#${exportName}`
  if (visited.has(visitKey)) {
    return undefined
  }
  visited.add(visitKey)

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) {
      continue
    }
    if (statement.moduleSpecifier === undefined) {
      if (
        statement.exportClause !== undefined &&
        ts.isNamedExports(statement.exportClause)
      ) {
        const local = statement.exportClause.elements.find(
          (element) => element.name.text === exportName,
        )
        if (local !== undefined) {
          return resolveExportedModuleDefinition(
            model,
            sourceFile,
            (local.propertyName ?? local.name).text,
            visited,
          )
        }
      }
      continue
    }
    if (!ts.isStringLiteral(statement.moduleSpecifier)) {
      continue
    }
    const targetSourceFile = getResolvedSourceFile(
      model,
      sourceFile,
      statement.moduleSpecifier.text,
    )
    if (targetSourceFile === undefined) {
      continue
    }
    if (statement.exportClause === undefined) {
      const reExported = resolveExportedModuleDefinition(
        model,
        targetSourceFile,
        exportName,
        visited,
      )
      if (reExported !== undefined) {
        return reExported
      }
      continue
    }
    if (!ts.isNamedExports(statement.exportClause)) {
      continue
    }
    const element = statement.exportClause.elements.find(
      (candidate) => candidate.name.text === exportName,
    )
    if (element !== undefined) {
      return resolveExportedModuleDefinition(
        model,
        targetSourceFile,
        (element.propertyName ?? element.name).text,
        visited,
      )
    }
  }
  return undefined
}

function resolveModuleDefinitionIdentifier(
  model: NestModuleModel,
  sourceFile: ts.SourceFile,
  identifier: ts.Identifier,
) {
  const local = model.byFileAndClassName.get(
    moduleDefinitionKey(sourceFile, identifier.text),
  )
  if (local !== undefined) {
    return local
  }
  const binding = getImportBindings(sourceFile).get(identifier.text)
  if (binding === undefined || binding.importedName === '*') {
    return undefined
  }
  const targetSourceFile = getResolvedSourceFile(
    model,
    sourceFile,
    binding.moduleName,
  )
  return targetSourceFile === undefined
    ? undefined
    : resolveExportedModuleDefinition(
        model,
        targetSourceFile,
        binding.importedName,
      )
}

interface RuntimeDeclaration {
  declaration: ts.Declaration
  name: string
  sourceFile: ts.SourceFile
}

// 沿显式导出链解析可参与 Nest 组合的运行时声明。
function resolveExportedRuntimeDeclaration(
  model: NestModuleModel,
  sourceFile: ts.SourceFile,
  exportName: string,
  visited = new Set<string>(),
): RuntimeDeclaration | undefined {
  const visitKey = `${sourceFileKey(sourceFile.fileName)}#${exportName}`
  if (visited.has(visitKey)) {
    return undefined
  }
  visited.add(visitKey)

  for (const statement of sourceFile.statements) {
    if (
      (ts.isClassDeclaration(statement) ||
        ts.isFunctionDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name?.text === exportName
    ) {
      return { declaration: statement, name: exportName, sourceFile }
    }
    if (ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations.find(
        (candidate) =>
          ts.isIdentifier(candidate.name) && candidate.name.text === exportName,
      )
      if (declaration !== undefined) {
        return { declaration, name: exportName, sourceFile }
      }
    }
  }

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) {
      continue
    }
    if (statement.moduleSpecifier === undefined) {
      if (
        statement.exportClause !== undefined &&
        ts.isNamedExports(statement.exportClause)
      ) {
        const local = statement.exportClause.elements.find(
          (element) => element.name.text === exportName,
        )
        if (local !== undefined) {
          return resolveExportedRuntimeDeclaration(
            model,
            sourceFile,
            (local.propertyName ?? local.name).text,
            visited,
          )
        }
      }
      continue
    }
    if (!ts.isStringLiteral(statement.moduleSpecifier)) {
      continue
    }
    const targetSourceFile = getResolvedSourceFile(
      model,
      sourceFile,
      statement.moduleSpecifier.text,
    )
    if (targetSourceFile === undefined) {
      continue
    }
    if (statement.exportClause === undefined) {
      const reExported = resolveExportedRuntimeDeclaration(
        model,
        targetSourceFile,
        exportName,
        visited,
      )
      if (reExported !== undefined) {
        return reExported
      }
      continue
    }
    if (!ts.isNamedExports(statement.exportClause)) {
      continue
    }
    const element = statement.exportClause.elements.find(
      (candidate) => candidate.name.text === exportName,
    )
    if (element !== undefined) {
      return resolveExportedRuntimeDeclaration(
        model,
        targetSourceFile,
        (element.propertyName ?? element.name).text,
        visited,
      )
    }
  }
  return undefined
}

// 将本地标识符或导入绑定解析为其规范运行时声明。
function resolveRuntimeDeclarationIdentifier(
  model: NestModuleModel,
  sourceFile: ts.SourceFile,
  identifier: ts.Identifier,
) {
  const binding = getImportBindings(sourceFile).get(identifier.text)
  if (binding === undefined) {
    return resolveExportedRuntimeDeclaration(model, sourceFile, identifier.text)
  }
  if (binding.importedName === '*') {
    return undefined
  }
  const targetSourceFile = getResolvedSourceFile(
    model,
    sourceFile,
    binding.moduleName,
  )
  return targetSourceFile === undefined
    ? undefined
    : resolveExportedRuntimeDeclaration(
        model,
        targetSourceFile,
        binding.importedName,
      )
}

// 为类、字符串和 Symbol 依赖生成跨文件稳定的组合令牌。
function getCanonicalCompositionToken(
  model: NestModuleModel,
  sourceFile: ts.SourceFile,
  expression: ts.Expression,
) {
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return `string:${expression.text}`
  }
  if (!ts.isIdentifier(expression)) {
    return undefined
  }
  const binding = getImportBindings(sourceFile).get(expression.text)
  if (binding?.moduleName.startsWith('@nestjs/')) {
    return undefined
  }
  if (binding !== undefined) {
    const resolvedFileName = resolveModule(
      binding.moduleName,
      sourceFile.fileName,
      model.compilerOptions,
      model.resolutionCache,
    )
    if (
      resolvedFileName === undefined ||
      !/^(?:apps|db|libs)\//.test(toRepoPath(model.root, resolvedFileName))
    ) {
      return undefined
    }
  }
  const declaration = resolveRuntimeDeclarationIdentifier(
    model,
    sourceFile,
    expression,
  )
  if (declaration !== undefined) {
    if (
      ts.isVariableDeclaration(declaration.declaration) &&
      declaration.declaration.initializer !== undefined &&
      (ts.isStringLiteral(declaration.declaration.initializer) ||
        ts.isNoSubstitutionTemplateLiteral(declaration.declaration.initializer))
    ) {
      return `string:${declaration.declaration.initializer.text}`
    }
    const declarationPath = toRepoPath(
      model.root,
      declaration.sourceFile.fileName,
    )
    if (!/^(?:apps|db|libs)\//.test(declarationPath)) {
      return undefined
    }
    return `class:${declarationPath}#${declaration.name}`
  }
  return getProviderToken(
    model.root,
    sourceFile,
    expression,
    getImportBindings(sourceFile),
    model.compilerOptions,
    model.resolutionCache,
  )
}

function primitiveValue(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  value: boolean | null | number | string | undefined,
): EvaluatedValue {
  return { kind: 'primitive', node, sourceFile, value }
}

function unknownValue(
  sourceFile: ts.SourceFile,
  node: ts.Node,
): EvaluatedValue {
  return { kind: 'unknown', node, sourceFile }
}

function getObjectPropertyValue(value: EvaluatedValue, name: string) {
  return value.kind === 'object' ? value.properties?.get(name) : undefined
}

function evaluateExpression(
  model: NestModuleModel,
  expression: ts.Expression,
  context: EvaluationContext,
): EvaluatedValue {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return evaluateExpression(model, expression.expression, context)
  }
  if (ts.isArrayLiteralExpression(expression)) {
    const values: EvaluatedValue[] = []
    for (const element of expression.elements) {
      if (ts.isSpreadElement(element)) {
        const spread = evaluateExpression(model, element.expression, context)
        if (spread.kind === 'array') {
          values.push(...(spread.values ?? []))
        } else {
          values.push(unknownValue(context.sourceFile, element))
        }
      } else if (ts.isExpression(element)) {
        values.push(evaluateExpression(model, element, context))
      }
    }
    return {
      kind: 'array',
      node: expression,
      sourceFile: context.sourceFile,
      values,
    }
  }
  if (ts.isObjectLiteralExpression(expression)) {
    const properties = new Map<string, EvaluatedValue>()
    for (const property of expression.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spread = evaluateExpression(model, property.expression, context)
        if (spread.kind === 'object') {
          for (const [name, value] of spread.properties ?? []) {
            properties.set(name, value)
          }
        } else {
          addModelViolation(
            model,
            context.sourceFile,
            property,
            'dynamic module metadata object spread must resolve to a static object',
          )
        }
        continue
      }
      if (!ts.isPropertyAssignment(property)) {
        if (ts.isShorthandPropertyAssignment(property)) {
          properties.set(
            property.name.text,
            evaluateExpression(model, property.name, context),
          )
          continue
        }
        addModelViolation(
          model,
          context.sourceFile,
          property,
          'dynamic module metadata object must use static property assignments',
        )
        continue
      }
      const propertyName = ts.isIdentifier(property.name)
        ? property.name.text
        : ts.isStringLiteral(property.name) ||
            ts.isNumericLiteral(property.name)
          ? property.name.text
          : undefined
      if (propertyName === undefined) {
        addModelViolation(
          model,
          context.sourceFile,
          property.name,
          'dynamic module metadata property name must be static',
        )
        continue
      }
      properties.set(
        propertyName,
        evaluateExpression(model, property.initializer, context),
      )
    }
    return {
      kind: 'object',
      node: expression,
      properties,
      sourceFile: context.sourceFile,
    }
  }
  if (ts.isIdentifier(expression)) {
    const fromEnvironment = context.environment.get(expression.text)
    if (fromEnvironment !== undefined) {
      return fromEnvironment
    }
    if (expression.text === 'undefined') {
      return primitiveValue(context.sourceFile, expression, undefined)
    }
    const classDefinition = resolveModuleDefinitionIdentifier(
      model,
      context.sourceFile,
      expression,
    )
    if (classDefinition !== undefined) {
      return {
        classDefinition,
        kind: 'module',
        node: expression,
        sourceFile: context.sourceFile,
      }
    }
    const binding = getImportBindings(context.sourceFile).get(expression.text)
    if (binding !== undefined && binding.moduleName.startsWith('@nestjs/')) {
      return {
        kind: 'external',
        node: expression,
        sourceFile: context.sourceFile,
      }
    }
    const runtimeDeclaration = resolveRuntimeDeclarationIdentifier(
      model,
      context.sourceFile,
      expression,
    )
    if (
      runtimeDeclaration !== undefined &&
      ts.isVariableDeclaration(runtimeDeclaration.declaration) &&
      runtimeDeclaration.declaration.initializer !== undefined &&
      runtimeDeclaration.declaration.initializer !== expression &&
      (ts.isArrayLiteralExpression(
        runtimeDeclaration.declaration.initializer,
      ) ||
        ts.isObjectLiteralExpression(
          runtimeDeclaration.declaration.initializer,
        ) ||
        ts.isStringLiteral(runtimeDeclaration.declaration.initializer) ||
        ts.isNoSubstitutionTemplateLiteral(
          runtimeDeclaration.declaration.initializer,
        ) ||
        ts.isNumericLiteral(runtimeDeclaration.declaration.initializer) ||
        runtimeDeclaration.declaration.initializer.kind ===
          ts.SyntaxKind.TrueKeyword ||
        runtimeDeclaration.declaration.initializer.kind ===
          ts.SyntaxKind.FalseKeyword ||
        runtimeDeclaration.declaration.initializer.kind ===
          ts.SyntaxKind.NullKeyword)
    ) {
      return evaluateExpression(
        model,
        runtimeDeclaration.declaration.initializer,
        {
          environment: new Map(),
          sourceFile: runtimeDeclaration.sourceFile,
        },
      )
    }
    return { kind: 'symbol', node: expression, sourceFile: context.sourceFile }
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const receiver = evaluateExpression(model, expression.expression, context)
    const property = getObjectPropertyValue(receiver, expression.name.text)
    return property ?? primitiveValue(context.sourceFile, expression, undefined)
  }
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return primitiveValue(context.sourceFile, expression, expression.text)
  }
  if (ts.isNumericLiteral(expression)) {
    return primitiveValue(
      context.sourceFile,
      expression,
      Number(expression.text),
    )
  }
  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return primitiveValue(context.sourceFile, expression, true)
  }
  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return primitiveValue(context.sourceFile, expression, false)
  }
  if (expression.kind === ts.SyntaxKind.NullKeyword) {
    return primitiveValue(context.sourceFile, expression, null)
  }
  if (ts.isBinaryExpression(expression)) {
    if (expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      const left = evaluateExpression(model, expression.left, context)
      if (
        left.kind === 'primitive' &&
        (left.value === undefined || left.value === null)
      ) {
        return evaluateExpression(model, expression.right, context)
      }
      return left
    }
    return unknownValue(context.sourceFile, expression)
  }
  if (ts.isConditionalExpression(expression)) {
    const condition = evaluateCondition(model, expression.condition, context)
    if (condition === true) {
      return evaluateExpression(model, expression.whenTrue, context)
    }
    if (condition === false) {
      return evaluateExpression(model, expression.whenFalse, context)
    }
    return unknownValue(context.sourceFile, expression)
  }
  if (ts.isCallExpression(expression)) {
    const dynamicFactory = resolveDynamicFactoryCall(model, expression, context)
    if (dynamicFactory !== undefined) {
      return {
        dynamicFactory,
        kind: 'dynamic',
        node: expression,
        sourceFile: context.sourceFile,
        values: expression.arguments.map((argument) =>
          evaluateExpression(model, argument, context),
        ),
      }
    }
    return {
      kind: 'external',
      node: expression,
      sourceFile: context.sourceFile,
    }
  }
  return unknownValue(context.sourceFile, expression)
}

function evaluateCondition(
  model: NestModuleModel,
  expression: ts.Expression,
  context: EvaluationContext,
): boolean | undefined {
  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const nested = evaluateCondition(model, expression.operand, context)
    return nested === undefined ? undefined : !nested
  }
  const value = evaluateExpression(model, expression, context)
  return value.kind === 'primitive' && typeof value.value === 'boolean'
    ? value.value
    : undefined
}

function resolveDynamicFactoryCall(
  model: NestModuleModel,
  expression: ts.CallExpression,
  context: EvaluationContext,
) {
  if (!ts.isPropertyAccessExpression(expression.expression)) {
    return undefined
  }
  const methodName = expression.expression.name.text
  const receiver = expression.expression.expression
  let classDefinition: ModuleDefinition | undefined
  if (receiver.kind === ts.SyntaxKind.ThisKeyword) {
    classDefinition = context.classDefinition
  } else if (ts.isIdentifier(receiver)) {
    classDefinition = resolveModuleDefinitionIdentifier(
      model,
      context.sourceFile,
      receiver,
    )
  }
  return classDefinition?.dynamicFactories.get(methodName)
}

function toStaticArray(
  model: NestModuleModel,
  value: EvaluatedValue | undefined,
  propertyName: string,
  sourceFile: ts.SourceFile,
  node: ts.Node,
) {
  if (value === undefined) {
    return []
  }
  if (value.kind === 'array') {
    return value.values ?? []
  }
  addModelViolation(
    model,
    sourceFile,
    node,
    `dynamic module ${propertyName} must resolve to a static array`,
  )
  return []
}

function ensureStaticallyExplainableDynamicValues(
  model: NestModuleModel,
  factory: DynamicFactoryDefinition,
  propertyName: string,
  values: EvaluatedValue[],
) {
  for (const value of values) {
    if (value.kind === 'unknown') {
      addModelViolation(
        model,
        value.sourceFile,
        value.node,
        `dynamic factory ${factory.id} ${propertyName} contains a value that cannot be statically explained`,
      )
    }
  }
  return values
}

// 静态执行受支持的 DynamicModule 工厂并合并类级模块元数据。
function executeDynamicFactory(
  model: NestModuleModel,
  dynamicValue: EvaluatedValue,
): DynamicModuleMetadata | undefined {
  const factory = dynamicValue.dynamicFactory
  if (factory === undefined) {
    return undefined
  }
  const invocationId = `${factory.id}@${formatLocation(
    getLocation(model.root, dynamicValue.sourceFile, dynamicValue.node, ''),
  )}`
  model.dynamicFactoryInvocations.add(invocationId)
  const environment = new Map<string, EvaluatedValue>()
  const context: EvaluationContext = {
    classDefinition: factory.classDefinition,
    environment,
    sourceFile: factory.classDefinition.sourceFile,
  }
  for (const [index, parameter] of factory.method.parameters.entries()) {
    if (!ts.isIdentifier(parameter.name)) {
      addModelViolation(
        model,
        factory.classDefinition.sourceFile,
        parameter,
        `dynamic factory ${factory.id} must use identifier parameters`,
      )
      continue
    }
    const argument = dynamicValue.values?.[index]
    environment.set(
      parameter.name.text,
      (argument === undefined ||
      (argument.kind === 'primitive' && argument.value === undefined)
        ? undefined
        : argument) ??
        (parameter.initializer === undefined
          ? primitiveValue(
              factory.classDefinition.sourceFile,
              parameter,
              undefined,
            )
          : evaluateExpression(model, parameter.initializer, context)),
    )
  }

  const runStatements = (
    statements: ts.NodeArray<ts.Statement>,
  ): EvaluatedValue | undefined => {
    for (const statement of statements) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) {
            addModelViolation(
              model,
              factory.classDefinition.sourceFile,
              declaration,
              `dynamic factory ${factory.id} must use identifier local bindings`,
            )
            continue
          }
          environment.set(
            declaration.name.text,
            declaration.initializer === undefined
              ? primitiveValue(
                  factory.classDefinition.sourceFile,
                  declaration,
                  undefined,
                )
              : evaluateExpression(model, declaration.initializer, context),
          )
        }
        continue
      }
      if (ts.isIfStatement(statement)) {
        const condition = evaluateCondition(
          model,
          statement.expression,
          context,
        )
        if (condition === undefined) {
          addModelViolation(
            model,
            factory.classDefinition.sourceFile,
            statement.expression,
            `dynamic factory ${factory.id} condition cannot be statically resolved for this composition`,
          )
          continue
        }
        const branch = condition
          ? statement.thenStatement
          : statement.elseStatement
        if (branch === undefined) {
          continue
        }
        const result = ts.isBlock(branch)
          ? runStatements(branch.statements)
          : runStatements(ts.factory.createNodeArray([branch]))
        if (result !== undefined) {
          return result
        }
        continue
      }
      if (
        ts.isExpressionStatement(statement) &&
        ts.isCallExpression(statement.expression)
      ) {
        const call = statement.expression
        if (
          ts.isPropertyAccessExpression(call.expression) &&
          call.expression.name.text === 'push' &&
          ts.isIdentifier(call.expression.expression)
        ) {
          const target = environment.get(call.expression.expression.text)
          if (target?.kind !== 'array') {
            addModelViolation(
              model,
              factory.classDefinition.sourceFile,
              call,
              `dynamic factory ${factory.id} can only push into a statically initialized array`,
            )
            continue
          }
          target.values?.push(
            ...call.arguments.map((argument) =>
              evaluateExpression(model, argument, context),
            ),
          )
        }
        continue
      }
      if (ts.isReturnStatement(statement)) {
        if (statement.expression === undefined) {
          addModelViolation(
            model,
            factory.classDefinition.sourceFile,
            statement,
            `dynamic factory ${factory.id} must return a DynamicModule object`,
          )
          return undefined
        }
        return evaluateExpression(model, statement.expression, context)
      }
      addModelViolation(
        model,
        factory.classDefinition.sourceFile,
        statement,
        `dynamic factory ${factory.id} contains unsupported control flow; make its module metadata statically explainable`,
      )
    }
    return undefined
  }

  const returned =
    factory.method.body === undefined
      ? undefined
      : runStatements(factory.method.body.statements)
  if (returned === undefined) {
    addModelViolation(
      model,
      factory.classDefinition.sourceFile,
      factory.method,
      `dynamic factory ${factory.id} has no statically explainable return value`,
    )
    return undefined
  }
  if (returned.kind === 'dynamic') {
    return executeDynamicFactory(model, returned)
  }
  if (returned.kind !== 'object') {
    addModelViolation(
      model,
      returned.sourceFile,
      returned.node,
      `dynamic factory ${factory.id} must return an object literal or delegate to another static DynamicModule factory`,
    )
    return undefined
  }
  const moduleValue = returned.properties?.get('module')
  if (
    moduleValue?.kind !== 'module' ||
    moduleValue.classDefinition === undefined
  ) {
    addModelViolation(
      model,
      returned.sourceFile,
      returned.node,
      `dynamic factory ${factory.id} module property must resolve to a local @Module class`,
    )
    return undefined
  }
  const staticMetadata = getStaticModuleMetadata(
    model,
    moduleValue.classDefinition,
  )
  const globalValue = returned.properties?.get('global')
  return {
    controllers: [
      ...staticMetadata.controllers,
      ...ensureStaticallyExplainableDynamicValues(
        model,
        factory,
        'controllers',
        toStaticArray(
          model,
          returned.properties?.get('controllers'),
          'controllers',
          returned.sourceFile,
          returned.node,
        ),
      ),
    ],
    exports: [
      ...staticMetadata.exports,
      ...ensureStaticallyExplainableDynamicValues(
        model,
        factory,
        'exports',
        toStaticArray(
          model,
          returned.properties?.get('exports'),
          'exports',
          returned.sourceFile,
          returned.node,
        ),
      ),
    ],
    imports: [
      ...staticMetadata.imports,
      ...ensureStaticallyExplainableDynamicValues(
        model,
        factory,
        'imports',
        toStaticArray(
          model,
          returned.properties?.get('imports'),
          'imports',
          returned.sourceFile,
          returned.node,
        ),
      ),
    ],
    isGlobal:
      moduleValue.classDefinition.isGlobal ||
      (globalValue?.kind === 'primitive' && globalValue.value === true),
    moduleDefinition: moduleValue.classDefinition,
    providers: [
      ...staticMetadata.providers,
      ...ensureStaticallyExplainableDynamicValues(
        model,
        factory,
        'providers',
        toStaticArray(
          model,
          returned.properties?.get('providers'),
          'providers',
          returned.sourceFile,
          returned.node,
        ),
      ),
    ],
  }
}

function getStaticModuleMetadata(
  model: NestModuleModel,
  definition: ModuleDefinition,
) {
  const context: EvaluationContext = {
    classDefinition: definition,
    environment: new Map(),
    sourceFile: definition.sourceFile,
  }
  const getArray = (field: keyof ModuleMetadataDefinition) => {
    const sourceExpression = definition.metadata[field]
    return sourceExpression === undefined
      ? []
      : toStaticArray(
          model,
          evaluateExpression(model, sourceExpression.expression, context),
          field,
          sourceExpression.sourceFile,
          sourceExpression.expression,
        )
  }
  return {
    controllers: getArray('controllers'),
    exports: getArray('exports'),
    imports: getArray('imports'),
    providers: getArray('providers'),
  }
}

function getCompositionProviderToken(
  model: NestModuleModel,
  value: EvaluatedValue,
): string | undefined {
  if (value.kind === 'primitive' && typeof value.value === 'string') {
    return `string:${value.value}`
  }
  if (value.kind === 'object') {
    const provide = value.properties?.get('provide')
    if (provide === undefined) {
      addModelViolation(
        model,
        value.sourceFile,
        value.node,
        'dynamic module provider object must declare a static provide token',
      )
      return undefined
    }
    return getCompositionProviderToken(model, provide)
  }
  if (value.kind === 'module' && value.classDefinition !== undefined) {
    return `class:${value.classDefinition.id}`
  }
  if (value.kind === 'symbol' && ts.isIdentifier(value.node)) {
    return getCanonicalCompositionToken(model, value.sourceFile, value.node)
  }
  if (value.kind === 'external') {
    return undefined
  }
  addModelViolation(
    model,
    value.sourceFile,
    value.node,
    'dynamic module provider must resolve to a class or static provide token',
  )
  return undefined
}

interface CompositionDependency {
  injection: string
  node: ts.Node
  optional: boolean
  token?: string
}

interface CompositionHost {
  dependencies: CompositionDependency[]
  kind: 'controller' | 'factory' | 'provider'
  label: string
  sourceFile: ts.SourceFile
}

// 获取指定名称的装饰器调用表达式。
function getDecoratorCall(
  node: ts.Node,
  name: string,
): ts.CallExpression | undefined {
  const decorator = ts
    .getDecorators(node)
    ?.find((candidate) => isDecoratorNamed(candidate, name))
  return decorator !== undefined && ts.isCallExpression(decorator.expression)
    ? decorator.expression
    : undefined
}

// 从构造参数类型提取可用于组合校验的依赖令牌。
function getDependencyTokenFromType(
  model: NestModuleModel,
  sourceFile: ts.SourceFile,
  type: ts.TypeNode | undefined,
) {
  if (
    type === undefined ||
    !ts.isTypeReferenceNode(type) ||
    !ts.isIdentifier(type.typeName)
  ) {
    return undefined
  }
  return getCanonicalCompositionToken(model, sourceFile, type.typeName)
}

// 收集类的构造器与属性注入依赖。
function collectClassDependencies(
  model: NestModuleModel,
  classDeclaration: ts.ClassDeclaration,
) {
  const sourceFile = classDeclaration.getSourceFile()
  const dependencies: CompositionDependency[] = []
  const constructor = classDeclaration.members.find(ts.isConstructorDeclaration)
  if (constructor !== undefined) {
    for (const [index, parameter] of constructor.parameters.entries()) {
      const inject = getDecoratorCall(parameter, 'Inject')
      const explicitToken = inject?.arguments[0]
      dependencies.push({
        injection: `constructor[${index}]`,
        node: explicitToken ?? parameter.type ?? parameter,
        optional: getDecoratorCall(parameter, 'Optional') !== undefined,
        token:
          explicitToken !== undefined
            ? getCanonicalCompositionToken(model, sourceFile, explicitToken)
            : getDependencyTokenFromType(model, sourceFile, parameter.type),
      })
    }
  }
  for (const member of classDeclaration.members) {
    if (!ts.isPropertyDeclaration(member)) {
      continue
    }
    const inject = getDecoratorCall(member, 'Inject')
    const explicitToken = inject?.arguments[0]
    if (explicitToken === undefined) {
      continue
    }
    dependencies.push({
      injection: `property:${member.name.getText(sourceFile)}`,
      node: explicitToken,
      optional: getDecoratorCall(member, 'Optional') !== undefined,
      token: getCanonicalCompositionToken(model, sourceFile, explicitToken),
    })
  }
  return dependencies
}

// 将控制器或提供者值解析到实际宿主类。
function resolveHostClass(
  model: NestModuleModel,
  value: EvaluatedValue | undefined,
) {
  if (value?.kind === 'symbol' && ts.isIdentifier(value.node)) {
    const declaration = resolveRuntimeDeclarationIdentifier(
      model,
      value.sourceFile,
      value.node,
    )
    return declaration !== undefined &&
      ts.isClassDeclaration(declaration.declaration)
      ? declaration.declaration
      : undefined
  }
  if (value?.kind === 'module') {
    return value.classDefinition?.classDeclaration
  }
  return undefined
}

// 建立控制器或类提供者的依赖宿主描述。
function createClassHost(
  model: NestModuleModel,
  value: EvaluatedValue,
  kind: 'controller' | 'provider',
): CompositionHost | undefined {
  const classDeclaration = resolveHostClass(model, value)
  if (classDeclaration?.name === undefined) {
    return undefined
  }
  return {
    dependencies: collectClassDependencies(model, classDeclaration),
    kind,
    label: classDeclaration.name.text,
    sourceFile: classDeclaration.getSourceFile(),
  }
}

// 解析工厂提供者 inject 数组中的单个令牌。
function getFactoryInjectionToken(
  model: NestModuleModel,
  value: EvaluatedValue,
) {
  if (value.kind === 'object') {
    const token = value.properties?.get('token')
    return {
      optional:
        value.properties?.get('optional')?.kind === 'primitive' &&
        value.properties.get('optional')?.value === true,
      token:
        token === undefined
          ? undefined
          : getCompositionProviderToken(model, token),
    }
  }
  return {
    optional: false,
    token: getCompositionProviderToken(model, value),
  }
}

// 生成人类可读的自定义提供者令牌标签。
function getCustomProviderLabel(provider: EvaluatedValue, fallback: string) {
  return (
    provider.properties?.get('provide')?.node.getText(provider.sourceFile) ??
    fallback
  )
}

// 收集模块实例中需要验证依赖可达性的全部宿主。
function collectInstanceHosts(
  model: NestModuleModel,
  instance: CompositionModuleInstance,
) {
  const hosts: CompositionHost[] = []
  for (const controller of instance.controllers) {
    const host = createClassHost(model, controller, 'controller')
    if (host !== undefined) {
      hosts.push(host)
    }
  }
  for (const provider of instance.providers) {
    if (provider.kind !== 'object') {
      const host = createClassHost(model, provider, 'provider')
      if (host !== undefined) {
        hosts.push(host)
      }
      continue
    }
    const useClass = provider.properties?.get('useClass')
    if (useClass !== undefined) {
      const host = createClassHost(model, useClass, 'provider')
      if (host !== undefined) {
        hosts.push(host)
      }
      continue
    }
    const useExisting = provider.properties?.get('useExisting')
    if (useExisting !== undefined) {
      hosts.push({
        dependencies: [
          {
            injection: 'useExisting',
            node: useExisting.node,
            optional: false,
            token: getCompositionProviderToken(model, useExisting),
          },
        ],
        kind: 'provider',
        label: getCustomProviderLabel(provider, '<useExisting-provider>'),
        sourceFile: provider.sourceFile,
      })
      continue
    }
    const inject = provider.properties?.get('inject')
    if (provider.properties?.has('useFactory') && inject?.kind === 'array') {
      const dependencies = (inject.values ?? []).map((value, index) => {
        const resolved = getFactoryInjectionToken(model, value)
        return {
          injection: `factory[${index}]`,
          node: value.node,
          optional: resolved.optional,
          token: resolved.token,
        }
      })
      hosts.push({
        dependencies,
        kind: 'factory',
        label: getCustomProviderLabel(provider, '<factory-provider>'),
        sourceFile: provider.sourceFile,
      })
    }
  }
  return hosts
}

// 按 Nest 模块可见性规则验证宿主依赖是否可达且唯一注册。
function collectCompositionDependencyViolations(
  model: NestModuleModel,
  rootDefinition: ModuleDefinition,
  instances: Map<string, CompositionModuleInstance>,
  edges: CompositionEdge[],
) {
  const children = new Map<string, Set<string>>()
  const parents = new Map<string, string>()
  for (const edge of edges) {
    const targets = children.get(edge.from) ?? new Set<string>()
    targets.add(edge.to)
    children.set(edge.from, targets)
    parents.set(edge.to, parents.get(edge.to) ?? edge.from)
  }

  const exportedTokenCache = new Map<string, Set<string>>()
  // 递归展开模块导出并缓存其对外可见令牌。
  const getExportedTokens = (
    instanceId: string,
    visiting = new Set<string>(),
  ): Set<string> => {
    const cached = exportedTokenCache.get(instanceId)
    if (cached !== undefined) {
      return cached
    }
    if (visiting.has(instanceId)) {
      return new Set()
    }
    visiting.add(instanceId)
    const tokens = new Set<string>()
    const instance = instances.get(instanceId)
    if (instance !== undefined) {
      for (const exported of instance.exports) {
        if (
          exported.kind === 'module' &&
          exported.classDefinition !== undefined
        ) {
          for (const childId of children.get(instanceId) ?? []) {
            const child = instances.get(childId)
            if (child?.moduleDefinition.id === exported.classDefinition.id) {
              for (const token of getExportedTokens(childId, visiting)) {
                tokens.add(token)
              }
            }
          }
          continue
        }
        if (
          exported.kind === 'dynamic' &&
          exported.dynamicFactory !== undefined
        ) {
          const exportedInstanceId = `dynamic:${exported.dynamicFactory.id}@${formatLocation(
            getLocation(model.root, exported.sourceFile, exported.node, ''),
          )}`
          if ((children.get(instanceId) ?? new Set()).has(exportedInstanceId)) {
            for (const token of getExportedTokens(
              exportedInstanceId,
              visiting,
            )) {
              tokens.add(token)
            }
          }
          continue
        }
        if (exported.kind === 'external' || exported.kind === 'unknown') {
          continue
        }
        const token = getCompositionProviderToken(model, exported)
        if (token !== undefined) {
          tokens.add(token)
        }
      }
    }
    visiting.delete(instanceId)
    exportedTokenCache.set(instanceId, tokens)
    return tokens
  }

  const globalTokens = new Set<string>()
  for (const instance of instances.values()) {
    if (!instance.isGlobal) {
      continue
    }
    for (const token of getExportedTokens(instance.id)) {
      globalTokens.add(token)
    }
  }

  const registrations = new Map<string, CompositionModuleInstance[]>()
  for (const instance of instances.values()) {
    for (const provider of instance.providers) {
      const token = getCompositionProviderToken(model, provider)
      if (token === undefined) {
        continue
      }
      const owners = registrations.get(token) ?? []
      owners.push(instance)
      registrations.set(token, owners)
    }
  }

  const rootInstanceId = `static:${rootDefinition.id}`
  // 生成从组合根到当前模块的最短导入轨迹。
  const getImportTrace = (instance: CompositionModuleInstance) => {
    const labels = [instance.label]
    let current = instance.id
    const visited = new Set<string>([current])
    while (current !== rootInstanceId) {
      const parent = parents.get(current)
      if (parent === undefined || visited.has(parent)) {
        break
      }
      visited.add(parent)
      labels.unshift(instances.get(parent)?.label ?? parent)
      current = parent
    }
    return labels.join(' -> ')
  }

  for (const instance of instances.values()) {
    const visibleTokens = new Set<string>(globalTokens)
    for (const provider of instance.providers) {
      const token = getCompositionProviderToken(model, provider)
      if (token !== undefined) {
        visibleTokens.add(token)
      }
    }
    for (const childId of children.get(instance.id) ?? []) {
      for (const token of getExportedTokens(childId)) {
        visibleTokens.add(token)
      }
    }

    for (const host of collectInstanceHosts(model, instance)) {
      for (const dependency of host.dependencies) {
        if (dependency.optional) {
          continue
        }
        if (dependency.token === undefined) {
          continue
        }
        if (visibleTokens.has(dependency.token)) {
          continue
        }
        const owner = registrations.get(dependency.token)?.[0]
        model.violations.push(
          getLocation(
            model.root,
            host.sourceFile,
            dependency.node,
            `Nest DI unreachable provider token root=${rootDefinition.className} rootFile=${toRepoPath(model.root, rootDefinition.sourceFile.fileName)} module=${instance.label} moduleFile=${toRepoPath(model.root, instance.moduleDefinition.sourceFile.fileName)} host=${host.label} hostFile=${toRepoPath(model.root, host.sourceFile.fileName)} hostKind=${host.kind} injection=${dependency.injection} token=${dependency.token} tokenSource=${dependency.token.slice('class:'.length).split('#')[0] ?? dependency.token} ownerModule=${owner?.label ?? '<none>'} ownerFile=${owner === undefined ? '<none>' : toRepoPath(model.root, owner.moduleDefinition.sourceFile.fileName)} reason=token is not reachable from module imports/providers/exports importTrace=${getImportTrace(instance)}`,
          ),
        )
      }
    }
  }
}

function collectCompositionProviderDuplicateViolations(
  model: NestModuleModel,
  rootDefinition: ModuleDefinition,
  instances: Map<string, CompositionModuleInstance>,
) {
  const registrations = new Map<
    string,
    Array<{
      instance: CompositionModuleInstance
      location: ArchitectureViolation
    }>
  >()
  for (const instance of instances.values()) {
    for (const provider of instance.providers) {
      const token = getCompositionProviderToken(model, provider)
      if (token === undefined) {
        continue
      }
      const entries = registrations.get(token) ?? []
      entries.push({
        instance,
        location: getLocation(
          model.root,
          provider.sourceFile,
          provider.node,
          `provider ${token} is registered here`,
        ),
      })
      registrations.set(token, entries)
    }
  }
  for (const [token, entries] of registrations) {
    if (entries.length < 2) {
      continue
    }
    for (const entry of entries) {
      const peer = entries.find((candidate) => candidate !== entry)
      if (peer !== undefined) {
        model.violations.push({
          ...entry.location,
          message: `duplicate provider ${token} in ${rootDefinition.id} composition; its other module registration is ${peer.instance.label} at ${formatLocation(peer.instance.location)}`,
        })
      }
    }
  }
}

function collectCompositionSccViolations(
  model: NestModuleModel,
  rootDefinition: ModuleDefinition,
  instances: Map<string, CompositionModuleInstance>,
  edges: CompositionEdge[],
) {
  const adjacency = new Map<string, CompositionEdge[]>()
  for (const instance of instances.values()) {
    adjacency.set(instance.id, [])
  }
  for (const edge of edges) {
    const outgoing = adjacency.get(edge.from) ?? []
    if (!outgoing.some((candidate) => candidate.to === edge.to)) {
      outgoing.push(edge)
      adjacency.set(edge.from, outgoing)
    }
  }
  let index = 0
  const indices = new Map<string, number>()
  const lowLinks = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const visit = (node: string): void => {
    indices.set(node, index)
    lowLinks.set(node, index)
    index += 1
    stack.push(node)
    onStack.add(node)
    for (const edge of adjacency.get(node) ?? []) {
      if (!indices.has(edge.to)) {
        visit(edge.to)
        lowLinks.set(
          node,
          Math.min(
            lowLinks.get(node) as number,
            lowLinks.get(edge.to) as number,
          ),
        )
      } else if (onStack.has(edge.to)) {
        lowLinks.set(
          node,
          Math.min(
            lowLinks.get(node) as number,
            indices.get(edge.to) as number,
          ),
        )
      }
    }
    if (lowLinks.get(node) !== indices.get(node)) {
      return
    }
    const component: string[] = []
    let member: string | undefined
    do {
      member = stack.pop()
      if (member !== undefined) {
        onStack.delete(member)
        component.push(member)
      }
    } while (member !== node)
    const isSelfCycle =
      component.length === 1 &&
      (adjacency.get(component[0]) ?? []).some(
        (edge) => edge.to === component[0],
      )
    if (component.length < 2 && !isSelfCycle) {
      return
    }
    const members = new Set(component)
    const evidence = edges.find(
      (edge) => members.has(edge.from) && members.has(edge.to),
    )
    if (evidence === undefined) {
      return
    }
    const labels = component
      .map((id) => instances.get(id)?.label ?? id)
      .sort()
      .join(', ')
    model.violations.push({
      ...evidence.location,
      message: `Nest module import SCC detected in ${rootDefinition.id} composition among ${labels}; remove the import cycle, do not use forwardRef()`,
    })
  }
  for (const node of [...adjacency.keys()].sort()) {
    if (!indices.has(node)) {
      visit(node)
    }
  }
}

function collectNestCompositionViolations(
  model: NestModuleModel,
  rootDefinition: ModuleDefinition,
) {
  const instances = new Map<string, CompositionModuleInstance>()
  const edges: CompositionEdge[] = []
  const visitValue = (
    value: EvaluatedValue,
    parent: CompositionModuleInstance | undefined,
  ): void => {
    let instance: CompositionModuleInstance | undefined
    if (value.kind === 'module' && value.classDefinition !== undefined) {
      if (value.classDefinition.dynamicFactories.size > 0) {
        addModelViolation(
          model,
          value.sourceFile,
          value.node,
          `bare import of provider-owning dynamic module ${value.classDefinition.className} is forbidden; call its explicit static factory`,
        )
        return
      }
      const metadata = getStaticModuleMetadata(model, value.classDefinition)
      instance = {
        ...metadata,
        id: `static:${value.classDefinition.id}`,
        isGlobal: value.classDefinition.isGlobal,
        label: value.classDefinition.className,
        location: getLocation(
          model.root,
          value.sourceFile,
          value.node,
          `module ${value.classDefinition.className} is imported here`,
        ),
        moduleDefinition: value.classDefinition,
      }
    } else if (value.kind === 'dynamic') {
      const metadata = executeDynamicFactory(model, value)
      if (metadata === undefined) {
        return
      }
      const factory = value.dynamicFactory as DynamicFactoryDefinition
      instance = {
        ...metadata,
        id: `dynamic:${factory.id}@${formatLocation(
          getLocation(model.root, value.sourceFile, value.node, ''),
        )}`,
        label: `${metadata.moduleDefinition.className}.${factory.name}()`,
        location: getLocation(
          model.root,
          value.sourceFile,
          value.node,
          `dynamic module ${metadata.moduleDefinition.className}.${factory.name}() is imported here`,
        ),
        moduleDefinition: metadata.moduleDefinition,
      }
    } else if (value.kind === 'external') {
      return
    } else {
      addModelViolation(
        model,
        value.sourceFile,
        value.node,
        'Nest module import must resolve to an internal @Module class or an explicit external module call',
      )
      return
    }
    if (parent !== undefined) {
      edges.push({
        from: parent.id,
        location: instance.location,
        to: instance.id,
      })
    }
    if (instances.has(instance.id)) {
      return
    }
    instances.set(instance.id, instance)
    for (const imported of instance.imports) {
      visitValue(imported, instance)
    }
  }

  visitValue(
    {
      classDefinition: rootDefinition,
      kind: 'module',
      node: rootDefinition.classDeclaration.name as ts.Identifier,
      sourceFile: rootDefinition.sourceFile,
    },
    undefined,
  )
  collectCompositionDependencyViolations(
    model,
    rootDefinition,
    instances,
    edges,
  )
  collectCompositionProviderDuplicateViolations(
    model,
    rootDefinition,
    instances,
  )
  collectCompositionSccViolations(model, rootDefinition, instances, edges)
}

function collectNestModuleCompositionViolations(
  root: string,
  sourceFiles: ts.SourceFile[],
  compilerOptions: ts.CompilerOptions,
  resolutionCache: ts.ModuleResolutionCache,
  violations: ArchitectureViolation[],
) {
  const model = createNestModuleModel(
    root,
    sourceFiles,
    compilerOptions,
    resolutionCache,
    violations,
  )
  const compositionRoots = model.moduleDefinitions.filter((definition) =>
    /^apps\/[^/]+\/src\/app\.module\.ts$/.test(
      toRepoPath(root, definition.sourceFile.fileName),
    ),
  )
  for (const rootDefinition of compositionRoots) {
    collectNestCompositionViolations(model, rootDefinition)
  }
}

/**
 * 收集 09 NestJS 架构不变量的静态违规项。
 */
export function collectNestArchitectureViolations(root: string) {
  const compilerOptions = readCompilerOptions(root)
  compilerOptions.baseUrl ??= root
  const resolutionCache = ts.createModuleResolutionCache(
    root,
    (fileName) => fileName,
    compilerOptions,
  )
  const sourceFiles = ['apps', 'libs', 'db', 'scripts']
    .flatMap((directory) => collectSourceFiles(join(root, directory)))
    .sort((left, right) => left.localeCompare(right))
    .map((filePath) =>
      ts.createSourceFile(
        filePath,
        readFileSync(filePath, 'utf8'),
        ts.ScriptTarget.ESNext,
        true,
      ),
    )
  const violations: ArchitectureViolation[] = []
  const edges: RuntimeEdge[] = []
  const providers = new Map<string, ProviderRegistration[]>()

  for (const sourceFile of sourceFiles) {
    collectPackageAndImportViolations(
      root,
      sourceFile,
      compilerOptions,
      resolutionCache,
      violations,
      edges,
    )
    collectSyntaxViolations(root, sourceFile, violations)
    collectProviderRegistrations(
      root,
      sourceFile,
      compilerOptions,
      resolutionCache,
      providers,
    )
  }

  violations.push(
    ...collectProviderDuplicateViolations(providers),
    ...collectSccViolations(edges),
  )
  collectNestModuleCompositionViolations(
    root,
    sourceFiles,
    compilerOptions,
    resolutionCache,
    violations,
  )
  return violations.sort((left, right) => {
    const location = formatLocation(left).localeCompare(formatLocation(right))
    return location === 0 ? left.message.localeCompare(right.message) : location
  })
}

function readRoot(argv = process.argv) {
  const args = argv.slice(2)
  if (args.length === 0) {
    return resolve(__dirname, '..')
  }
  if (args.length === 2 && args[0] === '--root') {
    return resolve(args[1])
  }
  throw new Error(
    'Usage: tsx scripts/check-nest-architecture.ts [--root <path>]',
  )
}

function main() {
  const violations = collectNestArchitectureViolations(readRoot())
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`${formatLocation(violation)}: ${violation.message}`)
    }
    process.exitCode = 1
    return
  }
  console.log('Nest architecture check passed')
}

if (require.main === module) {
  main()
}
