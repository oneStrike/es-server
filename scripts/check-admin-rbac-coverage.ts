import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'
import ts from 'typescript'

interface Finding {
  file: string
  line: number
  message: string
}

interface AdminRouteMetadata {
  file: string
  line: number
  methodName: string
  decorators: ts.Decorator[]
}

const ROOT = process.cwd()
const ADMIN_API_SRC = join(ROOT, 'apps/admin-api/src')
const LEGACY_ROLE_TARGETS = [
  join(ROOT, 'apps/admin-api/src'),
  join(ROOT, 'libs/identity/src'),
  join(ROOT, 'db/schema/admin'),
]
const HTTP_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete'])
const BYPASS_DECORATORS = new Set(['Public', 'AdminAuthOnly'])
const PERMISSION_CODE_RE = /^[a-z0-9]+(?::[a-z0-9]+)*(?:[-:][a-z0-9]+)*$/
const FORBIDDEN_LEGACY_ROLE_SYMBOLS = [
  'AdminUserRoleEnum',
  'adminUser.role',
  'this.adminUser.role',
  'role === 1',
  'role: smallint',
  'admin_user_role_valid_chk',
]

// 递归列出 admin-api 下的 controller 文件。
function listControllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      return listControllerFiles(full)
    }
    return entry.isFile() && entry.name.endsWith('.controller.ts') ? [full] : []
  })
}

// 递归列出需要扫描 legacy role debt 的 TypeScript 文件。
function listTypeScriptFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      return listTypeScriptFiles(full)
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [full] : []
  })
}

// 取节点上的装饰器，兼容 TypeScript 新旧 decorator API。
function getDecorators(node: ts.Node): ts.Decorator[] {
  return ts.canHaveDecorators(node) ? [...(ts.getDecorators(node) ?? [])] : []
}

// 获取装饰器调用名称。
function decoratorName(decorator: ts.Decorator): string | null {
  const expression = decorator.expression
  if (ts.isCallExpression(expression)) {
    const callee = expression.expression
    return ts.isIdentifier(callee) ? callee.text : null
  }
  return ts.isIdentifier(expression) ? expression.text : null
}

// 判断装饰器列表里是否包含指定装饰器。
function hasDecorator(decorators: ts.Decorator[], names: Set<string>): boolean {
  return decorators.some((decorator) => {
    const name = decoratorName(decorator)
    return name ? names.has(name) : false
  })
}

// 读取 @Controller('admin/...') 路径。
function readControllerPath(sourceFile: ts.SourceFile): string | null {
  for (const statement of sourceFile.statements) {
    if (!ts.isClassDeclaration(statement)) {
      continue
    }
    for (const decorator of getDecorators(statement)) {
      if (decoratorName(decorator) !== 'Controller') {
        continue
      }
      const expression = decorator.expression
      if (!ts.isCallExpression(expression)) {
        continue
      }
      const [pathArg] = expression.arguments
      if (pathArg && ts.isStringLiteralLike(pathArg)) {
        return pathArg.text
      }
    }
  }
  return null
}

// 读取 @AdminPermission({ code: '...' }) 中的权限编码。
function readAdminPermissionCode(decorators: ts.Decorator[]): string | null {
  for (const decorator of decorators) {
    if (decoratorName(decorator) !== 'AdminPermission') {
      continue
    }
    const expression = decorator.expression
    if (!ts.isCallExpression(expression)) {
      continue
    }
    const [options] = expression.arguments
    if (!options || !ts.isObjectLiteralExpression(options)) {
      return null
    }
    const codeProperty = options.properties.find(
      (property): property is ts.PropertyAssignment =>
        ts.isPropertyAssignment(property) &&
        ts.isIdentifier(property.name) &&
        property.name.text === 'code',
    )
    const initializer = codeProperty?.initializer
    return initializer && ts.isStringLiteralLike(initializer)
      ? initializer.text
      : null
  }
  return null
}

// 收集 admin controller 中所有 HTTP route handler。
function collectAdminRoutes(file: string): AdminRouteMetadata[] {
  const source = readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const controllerPath = readControllerPath(sourceFile)
  if (!controllerPath?.startsWith('admin')) {
    return []
  }
  const routes: AdminRouteMetadata[] = []
  const visit = (node: ts.Node) => {
    if (ts.isMethodDeclaration(node)) {
      const decorators = getDecorators(node)
      if (hasDecorator(decorators, HTTP_DECORATORS)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
        const methodName = ts.isIdentifier(node.name)
          ? node.name.text
          : node.name.getText(sourceFile)
        routes.push({
          file,
          line: line + 1,
          methodName,
          decorators,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return routes
}

// 校验 admin route 都有权限、登录或公开访问声明。
function checkControllers(): Finding[] {
  const findings: Finding[] = []
  const codes = new Map<string, string>()
  for (const file of listControllerFiles(ADMIN_API_SRC)) {
    for (const route of collectAdminRoutes(file)) {
      const fileRef = `${relative(ROOT, route.file)}:${route.line}`
      if (hasDecorator(route.decorators, BYPASS_DECORATORS)) {
        continue
      }
      const code = readAdminPermissionCode(route.decorators)
      if (!code) {
        findings.push({
          file: route.file,
          line: route.line,
          message: `${fileRef} ${route.methodName} missing @AdminPermission or @AdminAuthOnly`,
        })
        continue
      }
      if (!PERMISSION_CODE_RE.test(code)) {
        findings.push({
          file: route.file,
          line: route.line,
          message: `${fileRef} invalid permission code "${code}"`,
        })
      }
      const existing = codes.get(code)
      if (existing) {
        findings.push({
          file: route.file,
          line: route.line,
          message: `${fileRef} duplicate permission code "${code}", first seen at ${existing}`,
        })
      } else {
        codes.set(code, fileRef)
      }
    }
  }
  return findings
}

// 防止旧 admin_user.role 数字角色路径重新进入代码。
function checkLegacyRoleDebt(): Finding[] {
  const findings: Finding[] = []
  for (const file of LEGACY_ROLE_TARGETS.flatMap(listTypeScriptFiles)) {
    const source = readFileSync(file, 'utf8')
    const lines = source.split(/\r?\n/)
    lines.forEach((line, index) => {
      for (const needle of FORBIDDEN_LEGACY_ROLE_SYMBOLS) {
        if (line.includes(needle)) {
          findings.push({
            file,
            line: index + 1,
            message: `${relative(ROOT, file)}:${index + 1} contains legacy RBAC role debt: ${needle}`,
          })
        }
      }
    })
  }
  return findings
}

const findings = [...checkControllers(), ...checkLegacyRoleDebt()]
if (findings.length > 0) {
  console.error(findings.map((finding) => finding.message).join('\n'))
  process.exit(1)
}

console.log('admin RBAC coverage check passed')
