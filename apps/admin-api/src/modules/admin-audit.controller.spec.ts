import * as fs from 'node:fs'
import * as path from 'node:path'
import * as ts from 'typescript'

const adminModulesDir = path.resolve(__dirname)

const auditOptionalMethods = new Set([
  'auth/auth.controller.ts#refreshToken',
  'forum/sensitive-word/sensitive-word.controller.ts#detect',
  'forum/sensitive-word/sensitive-word.controller.ts#replaceSensitiveWords',
  'forum/sensitive-word/sensitive-word.controller.ts#getHighestSensitiveWordLevel',
])

interface MethodAuditSnapshot {
  content: string | null
  file: string
  hasApiAuditDoc: boolean
  hasAudit: boolean
  hasDoc: boolean
  httpMethod: string | null
  method: string
  summary: string | null
}

function walkControllers(dir: string, result: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkControllers(fullPath, result)
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.controller.ts')) {
      result.push(fullPath)
    }
  }
  return result
}

function getDecoratorCall(
  node: ts.MethodDeclaration,
  name: string,
): ts.CallExpression | null {
  const decorators
    = node.modifiers?.filter(
      modifier => modifier.kind === ts.SyntaxKind.Decorator,
    ) ?? []

  for (const decorator of decorators) {
    const expression = (decorator).expression
    if (
      ts.isCallExpression(expression)
      && ts.isIdentifier(expression.expression)
      && expression.expression.text === name
    ) {
      return expression
    }
  }

  return null
}

function getObjectLiteralArg(
  decoratorCall: ts.CallExpression | null,
): ts.ObjectLiteralExpression | null {
  const arg = decoratorCall?.arguments?.[0]
  return arg && ts.isObjectLiteralExpression(arg) ? arg : null
}

function getStringPropertyValue(
  objectLiteral: ts.ObjectLiteralExpression | null,
  propertyName: string,
) {
  for (const property of objectLiteral?.properties ?? []) {
    if (
      ts.isPropertyAssignment(property)
      && ts.isIdentifier(property.name)
      && property.name.text === propertyName
      && ts.isStringLiteral(property.initializer)
    ) {
      return property.initializer.text
    }
  }

  return null
}

function readMethodSnapshots() {
  const controllerFiles = walkControllers(adminModulesDir)
  const snapshots: MethodAuditSnapshot[] = []

  for (const controllerFile of controllerFiles) {
    const source = ts.createSourceFile(
      controllerFile,
      fs.readFileSync(controllerFile, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    ts.forEachChild(source, function visit(node) {
      if (!ts.isMethodDeclaration(node) || !node.name || !ts.isIdentifier(node.name)) {
        ts.forEachChild(node, visit)
        return
      }

      const httpMethod = ['Get', 'Post', 'Patch', 'Delete', 'Put'].find(name =>
        Boolean(getDecoratorCall(node, name)),
      ) ?? null
      const apiDocCall = getDecoratorCall(node, 'ApiDoc')
      const apiPageDocCall = getDecoratorCall(node, 'ApiPageDoc')
      const apiAuditDocCall = getDecoratorCall(node, 'ApiAuditDoc')
      const auditCall = getDecoratorCall(node, 'Audit')

      const relativeFile = path
        .relative(adminModulesDir, controllerFile)
        .replace(/\\/g, '/')

      snapshots.push({
        file: relativeFile,
        method: node.name.text,
        httpMethod,
        hasDoc: Boolean(apiDocCall || apiPageDocCall || apiAuditDocCall),
        hasAudit: Boolean(auditCall || apiAuditDocCall),
        hasApiAuditDoc: Boolean(apiAuditDocCall),
        summary: getStringPropertyValue(
          getObjectLiteralArg(apiDocCall ?? apiPageDocCall ?? apiAuditDocCall),
          'summary',
        ),
        content: getStringPropertyValue(
          getObjectLiteralArg(auditCall),
          'content',
        ),
      })

      ts.forEachChild(node, visit)
    })
  }

  return snapshots
}

describe('admin controller audit conventions', () => {
  it('uses ApiAuditDoc instead of repeating the same summary and audit content', () => {
    const duplicateMethods = readMethodSnapshots().filter(
      snapshot =>
        snapshot.hasAudit
        && !snapshot.hasApiAuditDoc
        && snapshot.summary
        && snapshot.content
        && snapshot.summary === snapshot.content,
    )

    expect(duplicateMethods).toEqual([])
  })

  it('keeps audit metadata on admin mutation endpoints unless explicitly exempted', () => {
    const missingAuditMethods = readMethodSnapshots().filter((snapshot) => {
      if (!snapshot.hasDoc || !snapshot.httpMethod || snapshot.httpMethod === 'Get') {
        return false
      }

      const key = `${snapshot.file}#${snapshot.method}`
      if (auditOptionalMethods.has(key)) {
        return false
      }

      return !snapshot.hasAudit
    })

    expect(missingAuditMethods).toEqual([])
  })
})
