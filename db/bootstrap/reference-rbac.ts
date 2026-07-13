import type { AdminReferencePermission } from '@libs/identity/admin-rbac.reference'
import type { NodePgTransaction } from 'drizzle-orm/node-postgres'
import type { EmptyRelations } from 'drizzle-orm/relations'
import {
  adminMenu,
  adminPermission,
  adminRbacRevision,
  adminRole,
  adminRoleMenu,
  adminRolePermission,
} from '@db/schema'
import { ADMIN_DEFAULT_MENUS } from '@libs/identity/admin-rbac-default-menus'

import {
  ADMIN_BASELINE_PERMISSION_CODES,
  ADMIN_RBAC_REVISION_CODE,
  AdminPermissionSource,
  AdminSystemRoleCode,
} from '@libs/identity/admin-rbac.constant'
import { eq, inArray, sql } from 'drizzle-orm'

/**
 * Reference bootstrap intentionally uses a core-query-builder-only Drizzle
 * client. Its helpers must not acquire the application RQB relation generic.
 */
export type ReferenceBootstrapTransaction = NodePgTransaction<EmptyRelations>

const ADMIN_BASELINE_PERMISSION_CODE_SET = new Set<string>(
  ADMIN_BASELINE_PERMISSION_CODES,
)

/**
 * 补齐 reference bootstrap 与应用启动同步共用的 RBAC 骨架。
 *
 * 调用方必须自行持有 RBAC mutation lock，并在同一个事务内继续写入权限、授权或
 * 引导管理员；本函数不启动嵌套事务。
 */
export async function ensureAdminRbacReferenceFoundation(
  tx: ReferenceBootstrapTransaction,
) {
  await tx
    .insert(adminRbacRevision)
    .values({ code: ADMIN_RBAC_REVISION_CODE, revision: 1 })
    .onConflictDoNothing()
  await ensureAdminRbacBuiltInRoles(tx)
  await ensureAdminRbacDefaultMenus(tx)
}

/**
 * 以 controller 装饰器的冻结清单写入 reference 权限。
 *
 * 该操作按权限编码幂等覆盖代码拥有的展示元数据；失效权限只能由应用启动时的实时
 * 扫描收敛，避免离线 bootstrap 在清单过期时误停用现有权限。
 */
export async function syncAdminRbacReferencePermissions(
  tx: ReferenceBootstrapTransaction,
  definitions: readonly AdminReferencePermission[],
) {
  if (definitions.length === 0) {
    return
  }

  const now = new Date()
  await tx
    .insert(adminPermission)
    .values(
      definitions.map((definition) => ({
        code: definition.code,
        description: definition.description ?? null,
        groupCode: definition.groupCode,
        isEnabled: true,
        name: definition.name,
        source: AdminPermissionSource.API,
      })),
    )
    .onConflictDoUpdate({
      set: {
        description: sql`excluded.description`,
        groupCode: sql`excluded.group_code`,
        isEnabled: sql`excluded.is_enabled`,
        name: sql`excluded.name`,
        source: sql`excluded.source`,
        updatedAt: now,
      },
      target: adminPermission.code,
    })
}

/**
 * 幂等授予内置角色所需的权限与菜单；超级管理员获得全部已启用项，普通管理员只保留
 * 自助账户和当前菜单能力。
 */
export async function grantAdminRbacBuiltInRoleDefaults(
  tx: ReferenceBootstrapTransaction,
) {
  const roles = await tx
    .select({ id: adminRole.id, code: adminRole.code })
    .from(adminRole)
    .where(
      inArray(adminRole.code, [
        AdminSystemRoleCode.SUPER_ADMIN,
        AdminSystemRoleCode.NORMAL_ADMIN,
      ]),
    )
  const rolesByCode = new Map(roles.map((role) => [role.code, role.id]))
  const superRoleId = rolesByCode.get(AdminSystemRoleCode.SUPER_ADMIN)
  const normalRoleId = rolesByCode.get(AdminSystemRoleCode.NORMAL_ADMIN)
  if (superRoleId === undefined || normalRoleId === undefined) {
    throw new Error('Built-in RBAC roles are missing')
  }

  const permissions = await tx
    .select({ id: adminPermission.id, code: adminPermission.code })
    .from(adminPermission)
    .where(eq(adminPermission.isEnabled, true))
  if (permissions.length > 0) {
    await tx
      .insert(adminRolePermission)
      .values(
        permissions.map((permission) => ({
          permissionId: permission.id,
          roleId: superRoleId,
        })),
      )
      .onConflictDoNothing()
    const baselinePermissions = permissions.filter((permission) =>
      ADMIN_BASELINE_PERMISSION_CODE_SET.has(permission.code),
    )
    if (baselinePermissions.length > 0) {
      await tx
        .insert(adminRolePermission)
        .values(
          baselinePermissions.map((permission) => ({
            permissionId: permission.id,
            roleId: normalRoleId,
          })),
        )
        .onConflictDoNothing()
    }
  }

  const menus = await tx
    .select({ id: adminMenu.id, code: adminMenu.code })
    .from(adminMenu)
    .where(eq(adminMenu.isEnabled, true))
  if (menus.length === 0) {
    return
  }

  await tx
    .insert(adminRoleMenu)
    .values(menus.map((menu) => ({ menuId: menu.id, roleId: superRoleId })))
    .onConflictDoNothing()
  const profileMenu = menus.find((menu) => menu.code === 'system_profile')
  if (profileMenu) {
    await tx
      .insert(adminRoleMenu)
      .values({ menuId: profileMenu.id, roleId: normalRoleId })
      .onConflictDoNothing()
  }
}

async function ensureAdminRbacBuiltInRoles(tx: ReferenceBootstrapTransaction) {
  await tx
    .insert(adminRole)
    .values({
      code: AdminSystemRoleCode.SUPER_ADMIN,
      description: '系统内置超级管理员，默认拥有全部权限和菜单',
      isEnabled: true,
      isSystem: true,
      name: '超级管理员',
      sortOrder: 1,
    })
    .onConflictDoNothing()
  await tx
    .insert(adminRole)
    .values({
      code: AdminSystemRoleCode.NORMAL_ADMIN,
      description: '系统内置普通管理员，仅保留基础自助能力',
      isEnabled: true,
      isSystem: true,
      name: '普通管理员',
      sortOrder: 2,
    })
    .onConflictDoNothing()
}

async function ensureAdminRbacDefaultMenus(tx: ReferenceBootstrapTransaction) {
  const [revision] = await tx
    .select({ menuSeededAt: adminRbacRevision.menuSeededAt })
    .from(adminRbacRevision)
    .where(eq(adminRbacRevision.code, ADMIN_RBAC_REVISION_CODE))
    .limit(1)
  if (!revision) {
    throw new Error('RBAC revision is missing')
  }
  if (revision.menuSeededAt) {
    return
  }

  const menuIdsByCode = await seedMissingAdminRbacDefaultMenus(tx)
  await normalizeAdminRbacDefaultMenuParents(tx, menuIdsByCode)
  const updated = await tx
    .update(adminRbacRevision)
    .set({ menuSeededAt: new Date(), updatedAt: new Date() })
    .where(eq(adminRbacRevision.code, ADMIN_RBAC_REVISION_CODE))
    .returning({ code: adminRbacRevision.code })
  if (updated.length !== 1) {
    throw new Error('RBAC revision is missing')
  }
}

async function seedMissingAdminRbacDefaultMenus(
  tx: ReferenceBootstrapTransaction,
) {
  const menuIdsByCode = new Map<string, number>()
  const existingMenus = await tx
    .select({ id: adminMenu.id, code: adminMenu.code })
    .from(adminMenu)
  for (const menu of existingMenus) {
    menuIdsByCode.set(menu.code, menu.id)
  }

  for (const menu of ADMIN_DEFAULT_MENUS) {
    const parentId = resolveAdminRbacDefaultMenuParentId(
      menuIdsByCode,
      menu.parentCode,
    )
    const [inserted] = await tx
      .insert(adminMenu)
      .values({
        code: menu.code,
        component: menu.component,
        icon: menu.icon,
        isEnabled: true,
        isVisible: menu.isVisible ?? true,
        keepAlive: menu.keepAlive ?? false,
        name: menu.name,
        parentId,
        path: menu.path,
        redirect: menu.redirect,
        sortOrder: menu.sortOrder,
        title: menu.title,
        type: menu.type,
      })
      .onConflictDoNothing()
      .returning({ id: adminMenu.id, code: adminMenu.code })
    if (inserted) {
      menuIdsByCode.set(inserted.code, inserted.id)
      continue
    }
    const [existing] = await tx
      .select({ id: adminMenu.id, code: adminMenu.code })
      .from(adminMenu)
      .where(eq(adminMenu.code, menu.code))
      .limit(1)
    if (!existing) {
      throw new Error(`Default admin menu is missing: ${menu.code}`)
    }
    menuIdsByCode.set(existing.code, existing.id)
  }

  return menuIdsByCode
}

async function normalizeAdminRbacDefaultMenuParents(
  tx: ReferenceBootstrapTransaction,
  menuIdsByCode: ReadonlyMap<string, number>,
) {
  for (const menu of ADMIN_DEFAULT_MENUS) {
    const menuId = menuIdsByCode.get(menu.code)
    if (menuId === undefined) {
      throw new Error(`Default admin menu is missing: ${menu.code}`)
    }
    const parentId = resolveAdminRbacDefaultMenuParentId(
      menuIdsByCode,
      menu.parentCode,
    )
    const updated = await tx
      .update(adminMenu)
      .set({ parentId, updatedAt: new Date() })
      .where(eq(adminMenu.id, menuId))
      .returning({ id: adminMenu.id })
    if (updated.length !== 1) {
      throw new Error(`Default admin menu is missing: ${menu.code}`)
    }
  }
}

function resolveAdminRbacDefaultMenuParentId(
  menuIdsByCode: ReadonlyMap<string, number>,
  parentCode: string | undefined,
) {
  if (!parentCode) {
    return null
  }
  const parentId = menuIdsByCode.get(parentCode)
  if (parentId === undefined) {
    throw new Error(`Default admin menu parent is missing: ${parentCode}`)
  }
  return parentId
}
