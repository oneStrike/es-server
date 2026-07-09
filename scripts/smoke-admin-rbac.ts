import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const root = process.cwd()
const service = readFileSync(
  join(root, 'apps/admin-api/src/modules/rbac/admin-rbac.service.ts'),
  'utf8',
)
const guard = readFileSync(
  join(root, 'apps/admin-api/src/modules/rbac/admin-rbac.guard.ts'),
  'utf8',
)
const schema = readFileSync(join(root, 'db/schema/admin/admin-rbac.ts'), 'utf8')
const dto = readFileSync(join(root, 'libs/identity/src/dto/admin-rbac.dto.ts'), 'utf8')
const revisionIncrementNeedle =
  'sql<number>`' + '$' + '{this.revisionTable.revision} + 1`'

const checks = [
  {
    ok:
      service.includes('admin:rbac:revision') ||
      service.includes('getCurrentRevision'),
    message: 'RBAC service must read the global revision path',
  },
  {
    ok: service.includes(revisionIncrementNeedle),
    message: 'RBAC revision bump must be DB-side atomic increment',
  },
  {
    ok: guard.includes("throw new ForbiddenException('缺少管理端权限元数据')"),
    message: 'RBAC guard must deny missing metadata',
  },
  {
    ok: schema.includes('admin_rbac_revision'),
    message: 'RBAC revision table schema is missing',
  },
  {
    ok: schema.includes('menuSeededAt'),
    message: 'RBAC revision must record one-time default menu seeding',
  },
  {
    ok:
      service.includes('retireMissingCodePermissions') &&
      service.includes('notInArray(this.permissionTable.code, activeCodes)'),
    message: 'RBAC sync must retire removed code permissions',
  },
  {
    ok:
      service.includes('eq(this.adminUserTable.isEnabled, true)') &&
      service.includes('ne(this.userRoleTable.adminUserId, adminUserId)'),
    message: 'Super admin guard must count other enabled admin users only',
  },
  {
    ok:
      service.includes('assertMenuParentIsNotDescendant') &&
      service.includes('WITH RECURSIVE descendants') &&
      service.includes('assertMenuHasNoChildren'),
    message: 'Menu mutations must enforce tree integrity server-side',
  },
  {
    ok:
      service.includes('seedMissingDefaultMenus') &&
      service.includes('normalizeDefaultMenuParents') &&
      !service.includes('menuCount > 0'),
    message: 'Default menu seeding must backfill partial seed state before marking complete',
  },
  {
    ok: !dto
      .slice(dto.indexOf('export class AdminRoleUpdateDto'), dto.indexOf('export class AdminRolePageDto'))
      .includes('isEnabled'),
    message: 'Role update DTO must not accept status changes',
  },
  {
    ok: !readFileSync(join(root, 'db/schema/admin/admin-user.ts'), 'utf8').includes('role:'),
    message: 'admin_user schema must not expose legacy numeric role',
  },
]

const failed = checks.filter((check) => !check.ok)
if (failed.length > 0) {
  console.error(failed.map((check) => check.message).join('\n'))
  process.exit(1)
}

console.log('admin RBAC smoke check passed')
