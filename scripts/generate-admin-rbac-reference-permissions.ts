import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import process from 'node:process'
import ts from 'typescript'

interface AdminReferencePermissionDefinition {
  code: string
  description?: string
  groupCode: string
  name: string
}

interface SourcePermissionDefinition extends AdminReferencePermissionDefinition {
  file: string
  handlerName: string
  line: number
}

interface ManifestResult {
  definitions: readonly AdminReferencePermissionDefinition[]
  digest: string
}

const WORKSPACE_ROOT = resolve(__dirname, '..')
const ADMIN_API_SOURCE_DIRECTORY = resolve(
  WORKSPACE_ROOT,
  'apps',
  'admin-api',
  'src',
)
const MANIFEST_PATH = resolve(
  WORKSPACE_ROOT,
  'db',
  'bootstrap',
  'admin-rbac-permissions.generated.ts',
)

/** 从 admin controller 权限装饰器生成供离线 bootstrap 使用的冻结清单。 */
export function collectAdminReferencePermissions(): ManifestResult {
  const sourceDefinitions = listControllerFiles(ADMIN_API_SOURCE_DIRECTORY)
    .flatMap(collectControllerPermissions)
    .sort((left, right) => left.code.localeCompare(right.code))
  assertUniquePermissionCodes(sourceDefinitions)

  const definitions = sourceDefinitions.map(
    ({ code, description, groupCode, name }) => ({
      code,
      ...(description === undefined ? {} : { description }),
      groupCode,
      name,
    }),
  )
  return {
    definitions,
    digest: createHash('sha256')
      .update(JSON.stringify(definitions), 'utf8')
      .digest('hex'),
  }
}

/** 确保已提交清单仍与 controller 装饰器完全一致。 */
export function assertAdminRbacReferencePermissionManifestCurrent() {
  const manifest = collectAdminReferencePermissions()
  const expected = renderManifest(manifest)
  let actual: string
  try {
    actual = readFileSync(MANIFEST_PATH, 'utf8')
  } catch (error) {
    throw new Error(
      `Admin RBAC reference permission manifest is missing: ${formatError(error)}`,
    )
  }
  if (actual !== expected) {
    throw new Error(
      'Admin RBAC reference permission manifest is stale; run pnpm db:bootstrap:reference:manifest:write',
    )
  }
  return { count: manifest.definitions.length, digest: manifest.digest }
}

/** 将当前 controller 装饰器投影写入受版本控制的 bootstrap 清单。 */
export function writeAdminRbacReferencePermissionManifest() {
  const manifest = collectAdminReferencePermissions()
  writeFileSync(MANIFEST_PATH, renderManifest(manifest), 'utf8')
  return { count: manifest.definitions.length, digest: manifest.digest }
}

function listControllerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      return listControllerFiles(fullPath)
    }
    return entry.isFile() && entry.name.endsWith('.controller.ts')
      ? [fullPath]
      : []
  })
}

function collectControllerPermissions(
  file: string,
): SourcePermissionDefinition[] {
  const source = readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
  )
  const definitions: SourcePermissionDefinition[] = []

  for (const statement of sourceFile.statements) {
    if (
      !ts.isClassDeclaration(statement) ||
      !hasDecorator(statement, 'Controller')
    ) {
      continue
    }
    for (const member of statement.members) {
      if (!ts.isMethodDeclaration(member)) {
        continue
      }
      const decorators = getDecorators(member).filter(
        (decorator) => decoratorName(decorator) === 'AdminPermission',
      )
      if (decorators.length > 1) {
        throw new Error(
          `${formatSourceLocation(sourceFile, file, member)} declares AdminPermission more than once`,
        )
      }
      const decorator = decorators[0]
      if (!decorator) {
        continue
      }
      const metadata = readPermissionMetadata(
        decorator,
        sourceFile,
        file,
        member,
      )
      definitions.push(metadata)
    }
  }

  return definitions
}

function getDecorators(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : []
}

function hasDecorator(node: ts.Node, name: string) {
  return getDecorators(node).some(
    (decorator) => decoratorName(decorator) === name,
  )
}

function decoratorName(decorator: ts.Decorator): string | undefined {
  const expression = decorator.expression
  if (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression)
  ) {
    return expression.expression.text
  }
  return ts.isIdentifier(expression) ? expression.text : undefined
}

function readPermissionMetadata(
  decorator: ts.Decorator,
  sourceFile: ts.SourceFile,
  file: string,
  method: ts.MethodDeclaration,
): SourcePermissionDefinition {
  const sourceLocation = formatSourceLocation(sourceFile, file, method)
  if (!ts.isCallExpression(decorator.expression)) {
    throw new Error(`${sourceLocation} AdminPermission must be invoked`)
  }
  const [argument] = decorator.expression.arguments
  if (!argument || !ts.isObjectLiteralExpression(argument)) {
    throw new Error(
      `${sourceLocation} AdminPermission requires an object literal`,
    )
  }

  const code = readStringProperty(argument, 'code', sourceLocation, true)
  const groupCode = readStringProperty(
    argument,
    'groupCode',
    sourceLocation,
    true,
  )
  const name = readStringProperty(argument, 'name', sourceLocation, true)
  const description = readStringProperty(
    argument,
    'description',
    sourceLocation,
    false,
  )
  if (code === undefined || groupCode === undefined || name === undefined) {
    throw new Error(`${sourceLocation} AdminPermission lacks a required value`)
  }
  const normalizedCode = code.trim()
  const normalizedGroupCode = groupCode.trim()
  const normalizedName = name.trim()
  if (!normalizedCode || !normalizedGroupCode || !normalizedName) {
    throw new Error(
      `${sourceLocation} AdminPermission required values cannot be blank`,
    )
  }

  return {
    code: normalizedCode,
    ...(description === undefined ? {} : { description }),
    file,
    groupCode: normalizedGroupCode,
    handlerName: method.name.getText(sourceFile),
    line: sourceFile.getLineAndCharacterOfPosition(method.getStart()).line + 1,
    name: normalizedName,
  }
}

function readStringProperty(
  object: ts.ObjectLiteralExpression,
  propertyName: string,
  sourceLocation: string,
  required: boolean,
) {
  const property = object.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) &&
      readPropertyName(candidate.name) === propertyName,
  )
  if (!property) {
    if (required) {
      throw new Error(`${sourceLocation} AdminPermission lacks ${propertyName}`)
    }
    return undefined
  }
  if (!ts.isStringLiteralLike(property.initializer)) {
    throw new Error(
      `${sourceLocation} AdminPermission.${propertyName} must be a string literal`,
    )
  }
  return property.initializer.text
}

function readPropertyName(name: ts.PropertyName) {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name)
    ? name.text
    : undefined
}

function assertUniquePermissionCodes(
  definitions: readonly SourcePermissionDefinition[],
) {
  const sourcesByCode = new Map<string, SourcePermissionDefinition>()
  for (const definition of definitions) {
    const existing = sourcesByCode.get(definition.code)
    if (existing) {
      throw new Error(
        `Duplicate AdminPermission code ${definition.code}: ${formatSourceDefinition(existing)} and ${formatSourceDefinition(definition)}`,
      )
    }
    sourcesByCode.set(definition.code, definition)
  }
}

function formatSourceDefinition(definition: SourcePermissionDefinition) {
  return `${relative(WORKSPACE_ROOT, definition.file).replaceAll('\\', '/')}:${definition.line} (${definition.handlerName})`
}

function formatSourceLocation(
  sourceFile: ts.SourceFile,
  file: string,
  node: ts.Node,
) {
  const line =
    sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
  return `${relative(WORKSPACE_ROOT, file).replaceAll('\\', '/')}:${line}`
}

function renderManifest(manifest: ManifestResult) {
  const entries = manifest.definitions
    .map((definition) => {
      const lines = [
        '  {',
        `    code: ${quoteTypeScriptString(definition.code)},`,
        ...(definition.description === undefined
          ? []
          : [
              `    description: ${quoteTypeScriptString(definition.description)},`,
            ]),
        `    groupCode: ${quoteTypeScriptString(definition.groupCode)},`,
        `    name: ${quoteTypeScriptString(definition.name)},`,
        '  },',
      ]
      return lines.join('\n')
    })
    .join('\n')
  return [
    "import type { AdminReferencePermission } from '@libs/identity/admin-rbac.reference'",
    '',
    '/**',
    ' * 由 scripts/generate-admin-rbac-reference-permissions.ts 从 controller 装饰器生成。',
    ' * 禁止手工编辑；修改 AdminPermission 后必须重新生成并提交该文件。',
    ' */',
    'export const ADMIN_REFERENCE_PERMISSIONS = [',
    entries,
    '] as const satisfies readonly AdminReferencePermission[]',
    '',
    'export const ADMIN_REFERENCE_PERMISSION_MANIFEST_DIGEST =',
    `  ${quoteTypeScriptString(manifest.digest)}`,
    '',
  ].join('\n')
}

function quoteTypeScriptString(value: string) {
  return `'${value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')}'`
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function main() {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args[0] !== undefined && args[0] !== '--write')) {
    throw new Error('Only --write is supported; omit it to verify the manifest')
  }
  const result =
    args[0] === '--write'
      ? writeAdminRbacReferencePermissionManifest()
      : assertAdminRbacReferencePermissionManifestCurrent()
  process.stdout.write(
    `${JSON.stringify({ ...result, status: args[0] === '--write' ? 'written' : 'current' })}\n`,
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
