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
const ADMIN_USER_CONTROLLER_FILE = join(
  ROOT,
  'apps/admin-api/src/modules/admin-user/admin-user.controller.ts',
)
const ADMIN_USER_MANAGEMENT_SERVICE_FILE = join(
  ROOT,
  'libs/identity/src/admin-user-management.service.ts',
)
const ADMIN_USER_IDENTITY_SERVICE_FILE = join(
  ROOT,
  'libs/identity/src/admin-user.service.ts',
)
const ADMIN_USER_TYPE_FILE = join(ROOT, 'libs/identity/src/admin-user.type.ts')
const ADMIN_RBAC_SERVICE_FILE = join(
  ROOT,
  'libs/identity/src/admin-rbac.service.ts',
)
const ADMIN_RBAC_CACHE_SERVICE_FILE = join(
  ROOT,
  'libs/identity/src/admin-rbac-cache.service.ts',
)
const ADMIN_AUTH_SERVICE_FILE = join(
  ROOT,
  'apps/admin-api/src/modules/auth/auth.service.ts',
)
const ADMIN_AUTH_DTO_FILE = join(
  ROOT,
  'libs/identity/src/dto/admin-auth.dto.ts',
)
const ADMIN_USER_DTO_FILE = join(
  ROOT,
  'libs/identity/src/dto/admin-user.dto.ts',
)
const ADMIN_RBAC_CONSTANT_FILE = join(
  ROOT,
  'libs/identity/src/admin-rbac.constant.ts',
)
const LEGACY_ROLE_TARGETS = [
  join(ROOT, 'apps/admin-api/src'),
  join(ROOT, 'libs/identity/src'),
  join(ROOT, 'db/schema/identity'),
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
const EXPECTED_BASELINE_PERMISSION_CODES = [
  'system:user:profile',
  'system:user:profile:update',
  'system:user:password:change',
  'system:menu:current',
]
const FORBIDDEN_BASELINE_PERMISSION_PREFIXES = [
  'system:user:create',
  'system:user:update',
  'system:user:page',
  'system:user:detail',
  'system:user:password:reset',
  'system:user:unlock',
  'system:role',
  'system:permission',
  'system:menu:create',
  'system:menu:update',
  'system:menu:delete',
  'system:menu:drag-sort',
  'system:menu:tree',
  'system:menu:status',
]

// 统一读取源码。
function readSource(file: string) {
  return readFileSync(file, 'utf8')
}

// 输出相对路径，便于 CI 日志定位。
function fileRef(file: string, line: number) {
  return `${relative(ROOT, file)}:${line}`
}

// 根据字符偏移计算 1-based 行号。
function lineOfIndex(source: string, index: number) {
  return source.slice(0, index).split(/\r?\n/).length
}

// 查找字符串所在行；缺失时返回文件首行。
function lineOfNeedle(source: string, needle: string) {
  const index = source.indexOf(needle)
  return index >= 0 ? lineOfIndex(source, index) : 1
}

// 查找正则命中的行；缺失时返回文件首行。
function lineOfPattern(source: string, pattern: RegExp) {
  const match = pattern.exec(source)
  pattern.lastIndex = 0
  return match?.index !== undefined ? lineOfIndex(source, match.index) : 1
}

// 添加缺失期望的检查。
function expectIncludes(
  findings: Finding[],
  file: string,
  source: string,
  needle: string,
  message: string,
) {
  if (!source.includes(needle)) {
    findings.push({ file, line: 1, message: `${fileRef(file, 1)} ${message}` })
  }
}

// 添加禁止字符串的检查。
function expectNotIncludes(
  findings: Finding[],
  file: string,
  source: string,
  needle: string,
  message: string,
) {
  if (source.includes(needle)) {
    const line = lineOfNeedle(source, needle)
    findings.push({ file, line, message: `${fileRef(file, line)} ${message}` })
  }
}

// 添加禁止正则的检查。
function expectNotMatches(
  findings: Finding[],
  file: string,
  source: string,
  pattern: RegExp,
  message: string,
) {
  if (pattern.test(source)) {
    pattern.lastIndex = 0
    const line = lineOfPattern(source, pattern)
    findings.push({ file, line, message: `${fileRef(file, line)} ${message}` })
  }
  pattern.lastIndex = 0
}

// 创建 TypeScript SourceFile。
function createSourceFile(file: string) {
  return ts.createSourceFile(
    file,
    readSource(file),
    ts.ScriptTarget.Latest,
    true,
  )
}

// 查找顶层 class。
function findClass(sourceFile: ts.SourceFile, className: string) {
  return sourceFile.statements.find(
    (statement): statement is ts.ClassDeclaration =>
      ts.isClassDeclaration(statement) && statement.name?.text === className,
  )
}

// 获取 class 源码和起始行。
function readClassText(file: string, className: string) {
  const sourceFile = createSourceFile(file)
  const node = findClass(sourceFile, className)
  if (!node) {
    return null
  }
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
  return {
    text: node.getText(sourceFile),
    line: line + 1,
  }
}

// 获取 class method 源码和起始行。
function readClassMethodText(
  file: string,
  className: string,
  methodName: string,
) {
  const sourceFile = createSourceFile(file)
  const classNode = findClass(sourceFile, className)
  if (!classNode) {
    return null
  }
  for (const member of classNode.members) {
    if (
      ts.isMethodDeclaration(member) &&
      member.name.getText(sourceFile) === methodName
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        member.getStart(),
      )
      return {
        text: member.getText(sourceFile),
        line: line + 1,
      }
    }
  }
  return null
}

// 读取字符串数组常量。
function readStringArrayConst(file: string, constName: string) {
  const sourceFile = createSourceFile(file)
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== constName
      ) {
        continue
      }
      let initializer = declaration.initializer
      if (!initializer) {
        return null
      }
      if (ts.isAsExpression(initializer)) {
        initializer = initializer.expression
      }
      if (!ts.isArrayLiteralExpression(initializer)) {
        return null
      }
      return initializer.elements
        .filter((element): element is ts.StringLiteralLike =>
          ts.isStringLiteralLike(element),
        )
        .map((element) => element.text)
    }
  }
  return null
}

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
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
  )
  const controllerPath = readControllerPath(sourceFile)
  if (!controllerPath?.startsWith('admin')) {
    return []
  }
  const routes: AdminRouteMetadata[] = []
  const visit = (node: ts.Node) => {
    if (ts.isMethodDeclaration(node)) {
      const decorators = getDecorators(node)
      if (hasDecorator(decorators, HTTP_DECORATORS)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(),
        )
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

// 防止管理员账号 DTO 与路由契约退回旧的混用模型。
function checkAdminUserContract(): Finding[] {
  const findings: Finding[] = []
  const authDtoSource = readSource(ADMIN_AUTH_DTO_FILE)
  const controllerSource = readSource(ADMIN_USER_CONTROLLER_FILE)

  for (const sourceFile of [
    ADMIN_USER_DTO_FILE,
    ADMIN_AUTH_DTO_FILE,
    ADMIN_USER_CONTROLLER_FILE,
    ADMIN_USER_MANAGEMENT_SERVICE_FILE,
    ADMIN_USER_IDENTITY_SERVICE_FILE,
  ]) {
    const source = readSource(sourceFile)
    expectNotIncludes(
      findings,
      sourceFile,
      source,
      'AdminUserResponseDto',
      'must not reintroduce AdminUserResponseDto mixed contract',
    )
    expectNotIncludes(
      findings,
      sourceFile,
      source,
      'UpdateUserDto',
      'must not reintroduce UpdateUserDto for self/admin account updates',
    )
  }

  const listDto = readClassText(ADMIN_USER_DTO_FILE, 'AdminUserListItemDto')
  if (!listDto) {
    findings.push({
      file: ADMIN_USER_DTO_FILE,
      line: 1,
      message: `${fileRef(ADMIN_USER_DTO_FILE, 1)} missing AdminUserListItemDto`,
    })
  } else {
    expectNotIncludes(
      findings,
      ADMIN_USER_DTO_FILE,
      listDto.text,
      'accessCodes',
      'AdminUserListItemDto must not expose permission codes',
    )
    expectNotIncludes(
      findings,
      ADMIN_USER_DTO_FILE,
      listDto.text,
      'isSuperAdmin',
      'AdminUserListItemDto must not expose super-admin authorization state',
    )
  }

  const currentDto = readClassText(ADMIN_USER_DTO_FILE, 'AdminCurrentUserDto')
  if (!currentDto) {
    findings.push({
      file: ADMIN_USER_DTO_FILE,
      line: 1,
      message: `${fileRef(ADMIN_USER_DTO_FILE, 1)} missing AdminCurrentUserDto`,
    })
  } else {
    expectIncludes(
      findings,
      ADMIN_USER_DTO_FILE,
      currentDto.text,
      'accessCodes',
      'AdminCurrentUserDto must include permission codes',
    )
    expectIncludes(
      findings,
      ADMIN_USER_DTO_FILE,
      currentDto.text,
      'isSuperAdmin',
      'AdminCurrentUserDto must include super-admin authorization state',
    )
  }

  expectIncludes(
    findings,
    ADMIN_AUTH_DTO_FILE,
    authDtoSource,
    'AdminCurrentUserDto',
    'LoginResponseDto.user must use AdminCurrentUserDto',
  )
  expectNotIncludes(
    findings,
    ADMIN_AUTH_DTO_FILE,
    authDtoSource,
    'AdminUserListItemDto',
    'LoginResponseDto.user must not use list DTO',
  )
  expectNotIncludes(
    findings,
    ADMIN_AUTH_DTO_FILE,
    authDtoSource,
    'AdminUserDetailDto',
    'LoginResponseDto.user must not use detail DTO',
  )

  expectIncludes(
    findings,
    ADMIN_USER_CONTROLLER_FILE,
    controllerSource,
    'AdminSelfProfileUpdateDto',
    'profile/update must use AdminSelfProfileUpdateDto',
  )
  expectIncludes(
    findings,
    ADMIN_USER_CONTROLLER_FILE,
    controllerSource,
    'AdminAccountUpdateDto',
    'admin account update must use AdminAccountUpdateDto',
  )
  expectIncludes(
    findings,
    ADMIN_USER_CONTROLLER_FILE,
    controllerSource,
    "'profile/update'",
    'self profile update route must remain profile/update',
  )
  expectIncludes(
    findings,
    ADMIN_USER_CONTROLLER_FILE,
    controllerSource,
    "@Controller('admin/system-user')",
    'admin account controller must keep admin/system-user prefix',
  )
  expectIncludes(
    findings,
    ADMIN_USER_CONTROLLER_FILE,
    controllerSource,
    "@Post('update')",
    'admin account update route must keep update handler path',
  )
  return findings
}

// 防止管理员列表退回 N+1、权限快照过曝或密码列过取。
function checkAdminUserListContract(): Finding[] {
  const findings: Finding[] = []
  const identityServiceSource = readSource(ADMIN_USER_IDENTITY_SERVICE_FILE)
  const typeSource = readSource(ADMIN_USER_TYPE_FILE)
  const getUsers = readClassMethodText(
    ADMIN_USER_MANAGEMENT_SERVICE_FILE,
    'AdminUserManagementService',
    'getUsers',
  )
  const getAdminUserPage = readClassMethodText(
    ADMIN_USER_IDENTITY_SERVICE_FILE,
    'AdminUserIdentityService',
    'getAdminUserPage',
  )

  if (!getUsers) {
    findings.push({
      file: ADMIN_USER_MANAGEMENT_SERVICE_FILE,
      line: 1,
      message: `${fileRef(ADMIN_USER_MANAGEMENT_SERVICE_FILE, 1)} missing getUsers`,
    })
  } else {
    expectIncludes(
      findings,
      ADMIN_USER_MANAGEMENT_SERVICE_FILE,
      getUsers.text,
      'this.adminUserIdentityService.getAdminUserPage',
      'getUsers must delegate list loading to the identity owner',
    )
  }

  if (!getAdminUserPage) {
    findings.push({
      file: ADMIN_USER_IDENTITY_SERVICE_FILE,
      line: 1,
      message: `${fileRef(ADMIN_USER_IDENTITY_SERVICE_FILE, 1)} missing getAdminUserPage`,
    })
  } else {
    expectIncludes(
      findings,
      ADMIN_USER_IDENTITY_SERVICE_FILE,
      getAdminUserPage.text,
      'exists(',
      'getAdminUserPage must filter roleId through exists instead of preloading user ids',
    )
    expectIncludes(
      findings,
      ADMIN_USER_IDENTITY_SERVICE_FILE,
      getAdminUserPage.text,
      'eq(this.adminUserRole.roleId, roleId)',
      'getAdminUserPage must correlate roleId exists filter to adminUserRole',
    )
    expectIncludes(
      findings,
      ADMIN_USER_IDENTITY_SERVICE_FILE,
      getAdminUserPage.text,
      'this.getRoleSummariesByUserIds',
      'getAdminUserPage must batch-load role summaries for the current page',
    )
    expectIncludes(
      findings,
      ADMIN_USER_IDENTITY_SERVICE_FILE,
      getAdminUserPage.text,
      '.select(this.adminUserResponseColumns)',
      'getAdminUserPage must select explicit non-password response columns',
    )
    expectNotMatches(
      findings,
      ADMIN_USER_IDENTITY_SERVICE_FILE,
      getAdminUserPage.text,
      /users\.map\(\s*async/,
      'getAdminUserPage must not map current page items through async N+1 loaders',
    )
    expectNotMatches(
      findings,
      ADMIN_USER_IDENTITY_SERVICE_FILE,
      getAdminUserPage.text,
      /\b(?:userIds|adminUserIds)\s*=/,
      'getAdminUserPage must not materialize all admin user ids for role filtering',
    )
  }

  expectIncludes(
    findings,
    ADMIN_USER_IDENTITY_SERVICE_FILE,
    identityServiceSource,
    'private get adminUserResponseColumns()',
    'AdminUserIdentityService must keep an explicit response column selector',
  )
  const responseColumnsStart = identityServiceSource.indexOf(
    'private get adminUserResponseColumns()',
  )
  if (responseColumnsStart >= 0) {
    const responseColumnsEnd = identityServiceSource.indexOf(
      '// 按用户名读取登录所需凭据与基础资料。',
      responseColumnsStart,
    )
    const responseColumnsSource = identityServiceSource.slice(
      responseColumnsStart,
      responseColumnsEnd > responseColumnsStart
        ? responseColumnsEnd
        : identityServiceSource.length,
    )
    const passwordIndex = responseColumnsSource.indexOf('password')
    if (passwordIndex >= 0) {
      const line = lineOfIndex(
        identityServiceSource,
        responseColumnsStart + passwordIndex,
      )
      findings.push({
        file: ADMIN_USER_IDENTITY_SERVICE_FILE,
        line,
        message: `${fileRef(ADMIN_USER_IDENTITY_SERVICE_FILE, line)} adminUserResponseColumns must not include password`,
      })
    }
  }
  expectIncludes(
    findings,
    ADMIN_USER_TYPE_FILE,
    typeSource,
    "Omit<AdminUserSelect, 'password'>",
    'AdminUserResponseRow must exclude password at type level',
  )

  return findings
}

// 防止账号资料和角色绑定退回非事务或静默角色兜底。
function checkAtomicAdminUserMutationContract(): Finding[] {
  const findings: Finding[] = []
  const adminUserManagementServiceSource = readSource(
    ADMIN_USER_MANAGEMENT_SERVICE_FILE,
  )
  const rbacServiceSource = readSource(ADMIN_RBAC_SERVICE_FILE)
  const updateAdminAccount = readClassMethodText(
    ADMIN_USER_MANAGEMENT_SERVICE_FILE,
    'AdminUserManagementService',
    'updateAdminAccount',
  )
  const register = readClassMethodText(
    ADMIN_USER_MANAGEMENT_SERVICE_FILE,
    'AdminUserManagementService',
    'register',
  )
  const normalizeRoleIds = readClassMethodText(
    ADMIN_RBAC_SERVICE_FILE,
    'AdminRbacService',
    'normalizeRoleIds',
  )

  for (const method of [
    { name: 'updateAdminAccount', node: updateAdminAccount },
    { name: 'register', node: register },
  ]) {
    if (!method.node) {
      findings.push({
        file: ADMIN_USER_MANAGEMENT_SERVICE_FILE,
        line: 1,
        message: `${fileRef(ADMIN_USER_MANAGEMENT_SERVICE_FILE, 1)} missing ${method.name}`,
      })
      continue
    }
    expectIncludes(
      findings,
      ADMIN_USER_MANAGEMENT_SERVICE_FILE,
      method.node.text,
      'this.adminUserIdentityService.withAdminAccountTransaction',
      `${method.name} must update account and role binding in one transaction`,
    )
    expectIncludes(
      findings,
      ADMIN_USER_MANAGEMENT_SERVICE_FILE,
      method.node.text,
      'bindUserRolesInTransaction',
      `${method.name} must bind roles inside the account mutation transaction`,
    )
    expectIncludes(
      findings,
      ADMIN_USER_MANAGEMENT_SERVICE_FILE,
      method.node.text,
      'normalizedRoleIds',
      `${method.name} must use normalized role ids for validation and binding`,
    )
  }

  expectIncludes(
    findings,
    ADMIN_USER_MANAGEMENT_SERVICE_FILE,
    adminUserManagementServiceSource,
    'invalidateUserAccess',
    'account role mutation must invalidate RBAC cache after commit',
  )
  expectIncludes(
    findings,
    ADMIN_RBAC_SERVICE_FILE,
    rbacServiceSource,
    'async bindUserRolesInTransaction',
    'AdminRbacService must expose transaction-scoped role binding',
  )
  expectIncludes(
    findings,
    ADMIN_RBAC_SERVICE_FILE,
    rbacServiceSource,
    'async invalidateUserAccess',
    'AdminRbacService must expose explicit post-commit user access invalidation',
  )
  expectIncludes(
    findings,
    ADMIN_RBAC_SERVICE_FILE,
    rbacServiceSource,
    'async getUserRoleSummariesInTransaction',
    'AdminRbacService must expose transaction-scoped role summary loading',
  )
  expectIncludes(
    findings,
    ADMIN_RBAC_SERVICE_FILE,
    rbacServiceSource,
    'async assertCanRemoveSuperAdminFromUserInTransaction',
    'last-super-admin protection must have a transaction-scoped variant',
  )
  expectIncludes(
    findings,
    ADMIN_RBAC_SERVICE_FILE,
    rbacServiceSource,
    'async lockSuperAdminMutationInTransaction',
    'super-admin grant and removal paths must share one transaction lock helper',
  )
  expectIncludes(
    findings,
    ADMIN_RBAC_SERVICE_FILE,
    rbacServiceSource,
    'acquireIntegrityLocks',
    'last-super-admin protection must acquire the canonical transaction lock',
  )
  expectIncludes(
    findings,
    ADMIN_RBAC_SERVICE_FILE,
    rbacServiceSource,
    'ADMIN_RBAC_RELATION_INTEGRITY_LOCKS.superAdminMembership',
    'last-super-admin protection must reference the canonical relation lock scope',
  )
  expectNotIncludes(
    findings,
    ADMIN_USER_MANAGEMENT_SERVICE_FILE,
    adminUserManagementServiceSource,
    'private async assertOperatorCanGrantSuperAdminRole(',
    'super-admin grant authorization must not have a pre-transaction helper',
  )
  if (updateAdminAccount) {
    expectIncludes(
      findings,
      ADMIN_USER_MANAGEMENT_SERVICE_FILE,
      updateAdminAccount.text,
      'ensureSafeAdminAccountUpdateInTransaction',
      'updateAdminAccount must run last-super-admin protection in the mutation transaction',
    )
    expectNotIncludes(
      findings,
      ADMIN_USER_MANAGEMENT_SERVICE_FILE,
      updateAdminAccount.text,
      'ensureSafeAdminAccountUpdate(',
      'updateAdminAccount must not use the old pre-transaction safety check',
    )
  }
  const ensureSafeAdminAccountUpdateInTransaction = readClassMethodText(
    ADMIN_USER_MANAGEMENT_SERVICE_FILE,
    'AdminUserManagementService',
    'ensureSafeAdminAccountUpdateInTransaction',
  )
  if (ensureSafeAdminAccountUpdateInTransaction) {
    expectIncludes(
      findings,
      ADMIN_USER_MANAGEMENT_SERVICE_FILE,
      ensureSafeAdminAccountUpdateInTransaction.text,
      'lockSuperAdminMutationInTransaction',
      'updateAdminAccount safety checks must acquire the shared lock before role-state reads',
    )
    expectIncludes(
      findings,
      ADMIN_USER_MANAGEMENT_SERVICE_FILE,
      ensureSafeAdminAccountUpdateInTransaction.text,
      'lockedTarget',
      'updateAdminAccount safety checks must re-read target account state after the shared lock',
    )
    expectNotIncludes(
      findings,
      ADMIN_USER_MANAGEMENT_SERVICE_FILE,
      ensureSafeAdminAccountUpdateInTransaction.text,
      'target.isEnabled',
      'updateAdminAccount safety checks must not use pre-transaction target.isEnabled',
    )
  }
  if (register) {
    expectIncludes(
      findings,
      ADMIN_USER_MANAGEMENT_SERVICE_FILE,
      register.text,
      'assertOperatorCanGrantSuperAdminRoleInTransaction',
      'register must authorize super-admin grants in the account creation transaction',
    )
    expectNotIncludes(
      findings,
      ADMIN_USER_MANAGEMENT_SERVICE_FILE,
      register.text,
      'assertOperatorCanGrantSuperAdminRole(',
      'register must not authorize super-admin grants before the account creation transaction',
    )
  }
  if (!normalizeRoleIds) {
    findings.push({
      file: ADMIN_RBAC_SERVICE_FILE,
      line: 1,
      message: `${fileRef(ADMIN_RBAC_SERVICE_FILE, 1)} missing normalizeRoleIds`,
    })
  } else {
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      normalizeRoleIds.text,
      '至少选择一个角色',
      'normalizeRoleIds must reject empty role sets',
    )
    expectNotIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      normalizeRoleIds.text,
      'AdminSystemRoleCode.NORMAL_ADMIN',
      'normalizeRoleIds must not silently fall back to normal_admin',
    )
  }

  return findings
}

// 防止 RBAC 授权路径退回缓存 revision、异常吞掉或协议异常混入领域服务。
function checkRbacFailClosedContract(): Finding[] {
  const findings: Finding[] = []
  const rbacServiceSource = readSource(ADMIN_RBAC_SERVICE_FILE)
  const cacheServiceSource = readSource(ADMIN_RBAC_CACHE_SERVICE_FILE)
  const getCurrentRevision = readClassMethodText(
    ADMIN_RBAC_SERVICE_FILE,
    'AdminRbacService',
    'getCurrentRevision',
  )
  const buildSubjectSnapshot = readClassMethodText(
    ADMIN_RBAC_SERVICE_FILE,
    'AdminRbacService',
    'buildSubjectSnapshot',
  )
  const extractExecutedRows = readClassMethodText(
    ADMIN_RBAC_SERVICE_FILE,
    'AdminRbacService',
    'extractExecutedRows',
  )
  const invalidate = readClassMethodText(
    ADMIN_RBAC_CACHE_SERVICE_FILE,
    'AdminRbacCacheService',
    'invalidate',
  )

  expectNotIncludes(
    findings,
    ADMIN_RBAC_SERVICE_FILE,
    rbacServiceSource,
    'ForbiddenException',
    'AdminRbacService must use BusinessException instead of protocol ForbiddenException',
  )
  expectNotIncludes(
    findings,
    ADMIN_RBAC_SERVICE_FILE,
    rbacServiceSource,
    'cache.getRevision',
    'authorization revision must not trust cached revision',
  )

  if (!getCurrentRevision) {
    findings.push({
      file: ADMIN_RBAC_SERVICE_FILE,
      line: 1,
      message: `${fileRef(ADMIN_RBAC_SERVICE_FILE, 1)} missing getCurrentRevision`,
    })
  } else {
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      getCurrentRevision.text,
      'RBAC版本不可用',
      'getCurrentRevision must fail closed when DB revision is unavailable',
    )
    expectNotIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      getCurrentRevision.text,
      'ensureRevision',
      'getCurrentRevision must not bootstrap or repair revision rows on the authorization read path',
    )
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      getCurrentRevision.text,
      'this.cache.setRevision',
      'getCurrentRevision may mirror DB revision to cache only after DB read',
    )
  }

  if (!buildSubjectSnapshot) {
    findings.push({
      file: ADMIN_RBAC_SERVICE_FILE,
      line: 1,
      message: `${fileRef(ADMIN_RBAC_SERVICE_FILE, 1)} missing buildSubjectSnapshot`,
    })
  } else {
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      buildSubjectSnapshot.text,
      'new Set(menuRows.map((item) => item.code))',
      'buildSubjectSnapshot must dedupe menu codes from multi-role grants',
    )
  }

  if (!extractExecutedRows) {
    findings.push({
      file: ADMIN_RBAC_SERVICE_FILE,
      line: 1,
      message: `${fileRef(ADMIN_RBAC_SERVICE_FILE, 1)} missing extractExecutedRows`,
    })
  } else {
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      extractExecutedRows.text,
      'RBAC原生查询结果结构异常',
      'extractExecutedRows must throw on malformed raw query results',
    )
    expectNotIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      extractExecutedRows.text,
      'return []',
      'extractExecutedRows must not silently return an empty result',
    )
  }

  expectNotIncludes(
    findings,
    ADMIN_RBAC_CACHE_SERVICE_FILE,
    cacheServiceSource,
    'Logger',
    'RBAC cache service must not swallow invalidation failures behind logging',
  )
  if (!invalidate) {
    findings.push({
      file: ADMIN_RBAC_CACHE_SERVICE_FILE,
      line: 1,
      message: `${fileRef(ADMIN_RBAC_CACHE_SERVICE_FILE, 1)} missing invalidate`,
    })
  } else {
    expectNotIncludes(
      findings,
      ADMIN_RBAC_CACHE_SERVICE_FILE,
      invalidate.text,
      'catch',
      'RBAC cache invalidation must surface failures',
    )
  }

  return findings
}

// 防止登录失败路径先写入 token 再读取 RBAC 授权视图。
function checkAuthLoginContract(): Finding[] {
  const findings: Finding[] = []
  const login = readClassMethodText(
    ADMIN_AUTH_SERVICE_FILE,
    'AuthService',
    'login',
  )

  if (!login) {
    findings.push({
      file: ADMIN_AUTH_SERVICE_FILE,
      line: 1,
      message: `${fileRef(ADMIN_AUTH_SERVICE_FILE, 1)} missing login`,
    })
    return findings
  }

  const snapshotIndex = login.text.indexOf(
    'this.rbacService.getSubjectSnapshot',
  )
  const persistIndex = login.text.indexOf(
    'this.authSessionService.persistTokens',
  )
  if (snapshotIndex < 0) {
    findings.push({
      file: ADMIN_AUTH_SERVICE_FILE,
      line: login.line,
      message: `${fileRef(ADMIN_AUTH_SERVICE_FILE, login.line)} login must read RBAC subject snapshot`,
    })
  }
  if (persistIndex < 0) {
    findings.push({
      file: ADMIN_AUTH_SERVICE_FILE,
      line: login.line,
      message: `${fileRef(ADMIN_AUTH_SERVICE_FILE, login.line)} login must persist tokens explicitly`,
    })
  }
  if (snapshotIndex >= 0 && persistIndex >= 0 && snapshotIndex > persistIndex) {
    const authSource = readSource(ADMIN_AUTH_SERVICE_FILE)
    const line = lineOfNeedle(
      authSource,
      'this.authSessionService.persistTokens',
    )
    findings.push({
      file: ADMIN_AUTH_SERVICE_FILE,
      line,
      message: `${fileRef(ADMIN_AUTH_SERVICE_FILE, line)} login must resolve RBAC snapshot before token persistence`,
    })
  }

  return findings
}

// 防止菜单写操作退回静默成功、祖先校验不在事务内或树返回孤儿节点。
function checkMenuIntegrityContract(): Finding[] {
  const findings: Finding[] = []
  const createMenu = readClassMethodText(
    ADMIN_RBAC_SERVICE_FILE,
    'AdminRbacService',
    'createMenu',
  )
  const updateMenu = readClassMethodText(
    ADMIN_RBAC_SERVICE_FILE,
    'AdminRbacService',
    'updateMenu',
  )
  const deleteMenu = readClassMethodText(
    ADMIN_RBAC_SERVICE_FILE,
    'AdminRbacService',
    'deleteMenu',
  )
  const updateMenuStatus = readClassMethodText(
    ADMIN_RBAC_SERVICE_FILE,
    'AdminRbacService',
    'updateMenuStatus',
  )
  const dragReorderMenu = readClassMethodText(
    ADMIN_RBAC_SERVICE_FILE,
    'AdminRbacService',
    'dragReorderMenu',
  )
  const normalizeDefaultMenuParents = readClassMethodText(
    ADMIN_RBAC_SERVICE_FILE,
    'AdminRbacService',
    'normalizeDefaultMenuParents',
  )
  const markDefaultMenusSeeded = readClassMethodText(
    ADMIN_RBAC_SERVICE_FILE,
    'AdminRbacService',
    'markDefaultMenusSeeded',
  )
  const buildMenuTree = readClassMethodText(
    ADMIN_RBAC_SERVICE_FILE,
    'AdminRbacService',
    'buildMenuTree',
  )

  if (createMenu) {
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      createMenu.text,
      'assertMenuIdsExist([data.parentId], tx)',
      'createMenu must validate parent menu inside the transaction',
    )
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      createMenu.text,
      '菜单创建失败',
      'createMenu must assert inserted menu rows',
    )
  } else {
    findings.push({
      file: ADMIN_RBAC_SERVICE_FILE,
      line: 1,
      message: `${fileRef(ADMIN_RBAC_SERVICE_FILE, 1)} missing createMenu`,
    })
  }

  if (updateMenu) {
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      updateMenu.text,
      'assertMenuParentIsNotDescendant(data.id, nextParentId, tx)',
      'updateMenu must validate ancestor cycles inside the transaction',
    )
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      updateMenu.text,
      '菜单不存在',
      'updateMenu must assert affected rows',
    )
  } else {
    findings.push({
      file: ADMIN_RBAC_SERVICE_FILE,
      line: 1,
      message: `${fileRef(ADMIN_RBAC_SERVICE_FILE, 1)} missing updateMenu`,
    })
  }

  if (deleteMenu) {
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      deleteMenu.text,
      'assertMenuIdsExist([id], tx)',
      'deleteMenu must verify target menu inside the transaction',
    )
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      deleteMenu.text,
      'assertMenuHasNoChildren(id, tx)',
      'deleteMenu must check children inside the transaction',
    )
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      deleteMenu.text,
      'deletedRows',
      'deleteMenu must assert deleted menu rows',
    )
  } else {
    findings.push({
      file: ADMIN_RBAC_SERVICE_FILE,
      line: 1,
      message: `${fileRef(ADMIN_RBAC_SERVICE_FILE, 1)} missing deleteMenu`,
    })
  }

  if (updateMenuStatus) {
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      updateMenuStatus.text,
      'updatedRows',
      'updateMenuStatus must assert affected rows',
    )
  } else {
    findings.push({
      file: ADMIN_RBAC_SERVICE_FILE,
      line: 1,
      message: `${fileRef(ADMIN_RBAC_SERVICE_FILE, 1)} missing updateMenuStatus`,
    })
  }

  if (dragReorderMenu) {
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      dragReorderMenu.text,
      'assertMenuParentIsNotDescendant(data.id, data.parentId, tx)',
      'dragReorderMenu must validate ancestor cycles inside the transaction',
    )
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      dragReorderMenu.text,
      'updatedRows',
      'dragReorderMenu must assert affected rows',
    )
  } else {
    findings.push({
      file: ADMIN_RBAC_SERVICE_FILE,
      line: 1,
      message: `${fileRef(ADMIN_RBAC_SERVICE_FILE, 1)} missing dragReorderMenu`,
    })
  }

  if (normalizeDefaultMenuParents) {
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      normalizeDefaultMenuParents.text,
      '默认菜单不存在',
      'default menu parent normalization must assert affected rows',
    )
  }
  if (markDefaultMenusSeeded) {
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      markDefaultMenusSeeded.text,
      'RBAC版本不存在',
      'default menu seed marker must assert affected revision rows',
    )
  }
  if (buildMenuTree) {
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      buildMenuTree.text,
      '!byId.has(row.id)',
      'buildMenuTree must dedupe duplicated menu rows',
    )
    expectIncludes(
      findings,
      ADMIN_RBAC_SERVICE_FILE,
      buildMenuTree.text,
      'row.parentId !== row.id && byId.has(row.parentId)',
      'buildMenuTree must drop self-parent and orphan nodes instead of making them roots',
    )
  }

  return findings
}

// 防止普通管理员基础权限重新获得账号、角色或菜单管理能力。
function checkBaselinePermissions(): Finding[] {
  const findings: Finding[] = []
  const baseline = readStringArrayConst(
    ADMIN_RBAC_CONSTANT_FILE,
    'ADMIN_BASELINE_PERMISSION_CODES',
  )

  if (!baseline) {
    findings.push({
      file: ADMIN_RBAC_CONSTANT_FILE,
      line: 1,
      message: `${fileRef(ADMIN_RBAC_CONSTANT_FILE, 1)} missing ADMIN_BASELINE_PERMISSION_CODES`,
    })
    return findings
  }

  const expected = new Set(EXPECTED_BASELINE_PERMISSION_CODES)
  const actual = new Set(baseline)
  for (const code of EXPECTED_BASELINE_PERMISSION_CODES) {
    if (!actual.has(code)) {
      findings.push({
        file: ADMIN_RBAC_CONSTANT_FILE,
        line: 1,
        message: `${fileRef(ADMIN_RBAC_CONSTANT_FILE, 1)} baseline permission missing ${code}`,
      })
    }
  }
  for (const code of baseline) {
    if (!expected.has(code)) {
      const line = lineOfNeedle(readSource(ADMIN_RBAC_CONSTANT_FILE), code)
      findings.push({
        file: ADMIN_RBAC_CONSTANT_FILE,
        line,
        message: `${fileRef(ADMIN_RBAC_CONSTANT_FILE, line)} unexpected baseline permission ${code}`,
      })
    }
    for (const prefix of FORBIDDEN_BASELINE_PERMISSION_PREFIXES) {
      if (code === prefix || code.startsWith(`${prefix}:`)) {
        const line = lineOfNeedle(readSource(ADMIN_RBAC_CONSTANT_FILE), code)
        findings.push({
          file: ADMIN_RBAC_CONSTANT_FILE,
          line,
          message: `${fileRef(ADMIN_RBAC_CONSTANT_FILE, line)} baseline permission must not grant management code ${code}`,
        })
      }
    }
  }

  return findings
}

const findings = [
  ...checkControllers(),
  ...checkLegacyRoleDebt(),
  ...checkAdminUserContract(),
  ...checkAdminUserListContract(),
  ...checkAtomicAdminUserMutationContract(),
  ...checkRbacFailClosedContract(),
  ...checkAuthLoginContract(),
  ...checkMenuIntegrityContract(),
  ...checkBaselinePermissions(),
]
if (findings.length > 0) {
  console.error(findings.map((finding) => finding.message).join('\n'))
  process.exit(1)
}

console.log('admin RBAC coverage check passed')
