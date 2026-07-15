import type {
  AdminMenuSelect as AdminMenuRow,
  AdminRoleSelect as AdminRoleRow,
} from '@db/schema'
import type {
  AdminMenuCreateDto,
  AdminMenuDragReorderDto,
  AdminMenuDto,
  AdminMenuUpdateDto,
  AdminPermissionDto,
  AdminRoleCreateDto,
  AdminRoleDto,
  AdminRoleMenuBindDto,
  AdminRolePageDto,
  AdminRolePermissionBindDto,
  AdminRoleSummaryDto,
  AdminRoleUpdateDto,
} from '@libs/identity/dto/admin-rbac.dto'
import type {
  AdminExecutedRowsResult,
  AdminMenuTreeNode,
  AdminMutableRole,
  AdminPermissionDefinition,
  AdminRbacDb,
  AdminRbacSubjectSnapshot,
  AdminRbacTransaction,
} from './admin-rbac.type'
import {
  acquireIntegrityLocks,
  ADMIN_RBAC_RELATION_INTEGRITY_LOCKS,
  buildILikeCondition,
  DrizzleService,
  exclusiveIntegrityLock,
  toPageResult,
} from '@db/core'
import { ADMIN_DEFAULT_MENUS } from '@libs/identity/admin-rbac-default-menus'
import {
  ADMIN_BASELINE_PERMISSION_CODES,
  ADMIN_RBAC_REVISION_CODE,
  AdminPermissionSource,
  AdminSystemRoleCode,
} from '@libs/identity/admin-rbac.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, asc, count, eq, inArray, ne, notInArray, sql } from 'drizzle-orm'
import { AdminRbacCacheService } from './admin-rbac-cache.service'

const ADMIN_BASELINE_PERMISSION_CODE_SET = new Set<string>(
  ADMIN_BASELINE_PERMISSION_CODES,
)

type AdminCurrentMenuRow = Pick<
  AdminMenuRow,
  | 'id'
  | 'code'
  | 'parentId'
  | 'title'
  | 'path'
  | 'name'
  | 'component'
  | 'redirect'
  | 'icon'
  | 'sortOrder'
  | 'isVisible'
  | 'keepAlive'
>

@Injectable()
export class AdminRbacService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cache: AdminRbacCacheService,
  ) {}

  // 统一读取 Drizzle 数据库实例。
  private get db() {
    return this.drizzle.db
  }

  // 角色管理端输出字段。
  private get roleOutputSelect() {
    return {
      id: this.roleTable.id,
      code: this.roleTable.code,
      name: this.roleTable.name,
      description: this.roleTable.description,
      isSystem: this.roleTable.isSystem,
      isEnabled: this.roleTable.isEnabled,
      sortOrder: this.roleTable.sortOrder,
      createdAt: this.roleTable.createdAt,
      updatedAt: this.roleTable.updatedAt,
    }
  }

  // 权限管理端输出字段。
  private get permissionOutputSelect() {
    return {
      id: this.permissionTable.id,
      code: this.permissionTable.code,
      name: this.permissionTable.name,
      groupCode: this.permissionTable.groupCode,
      description: this.permissionTable.description,
      source: this.permissionTable.source,
      isEnabled: this.permissionTable.isEnabled,
      createdAt: this.permissionTable.createdAt,
      updatedAt: this.permissionTable.updatedAt,
    }
  }

  // 后台菜单树输出字段。
  private get menuOutputSelect() {
    return {
      id: this.menuTable.id,
      code: this.menuTable.code,
      parentId: this.menuTable.parentId,
      type: this.menuTable.type,
      title: this.menuTable.title,
      path: this.menuTable.path,
      name: this.menuTable.name,
      component: this.menuTable.component,
      redirect: this.menuTable.redirect,
      icon: this.menuTable.icon,
      sortOrder: this.menuTable.sortOrder,
      isVisible: this.menuTable.isVisible,
      isEnabled: this.menuTable.isEnabled,
      keepAlive: this.menuTable.keepAlive,
      externalLink: this.menuTable.externalLink,
      createdAt: this.menuTable.createdAt,
      updatedAt: this.menuTable.updatedAt,
    }
  }

  // 当前管理员 bootstrap 菜单字段。
  private get currentMenuSelect() {
    return {
      id: this.menuTable.id,
      code: this.menuTable.code,
      parentId: this.menuTable.parentId,
      title: this.menuTable.title,
      path: this.menuTable.path,
      name: this.menuTable.name,
      component: this.menuTable.component,
      redirect: this.menuTable.redirect,
      icon: this.menuTable.icon,
      sortOrder: this.menuTable.sortOrder,
      isVisible: this.menuTable.isVisible,
      keepAlive: this.menuTable.keepAlive,
    }
  }

  // 角色写入前校验与补全所需字段。
  private get roleMutationSelect() {
    return {
      code: this.roleTable.code,
      name: this.roleTable.name,
      description: this.roleTable.description,
      isSystem: this.roleTable.isSystem,
      sortOrder: this.roleTable.sortOrder,
    }
  }

  // 菜单更新时合并 DTO 所需字段。
  private get menuUpdateSelect() {
    return {
      parentId: this.menuTable.parentId,
      type: this.menuTable.type,
      title: this.menuTable.title,
      path: this.menuTable.path,
      name: this.menuTable.name,
      component: this.menuTable.component,
      redirect: this.menuTable.redirect,
      icon: this.menuTable.icon,
      sortOrder: this.menuTable.sortOrder,
      isVisible: this.menuTable.isVisible,
      isEnabled: this.menuTable.isEnabled,
      keepAlive: this.menuTable.keepAlive,
      externalLink: this.menuTable.externalLink,
    }
  }

  // 管理端角色表。
  private get roleTable() {
    return this.drizzle.schema.adminRole
  }

  // 管理端权限表。
  private get permissionTable() {
    return this.drizzle.schema.adminPermission
  }

  // 管理端菜单表。
  private get menuTable() {
    return this.drizzle.schema.adminMenu
  }

  // 角色与权限关系表。
  private get rolePermissionTable() {
    return this.drizzle.schema.adminRolePermission
  }

  // 角色与菜单关系表。
  private get roleMenuTable() {
    return this.drizzle.schema.adminRoleMenu
  }

  // 管理员与角色关系表。
  private get userRoleTable() {
    return this.drizzle.schema.adminUserRole
  }

  // 管理员账号表。
  private get adminUserTable() {
    return this.drizzle.schema.adminUser
  }

  // RBAC 全局版本表。
  private get revisionTable() {
    return this.drizzle.schema.adminRbacRevision
  }

  // 同步代码装饰器声明的权限，并完成首次 RBAC bootstrap。
  async syncCodePermissions(definitions: AdminPermissionDefinition[]) {
    const uniqueDefinitions = this.assertUniqueDefinitions(definitions)
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireRbacMutationLocksInTransaction(tx)
        await this.ensureRevision(tx)
        await this.ensureBuiltInRoles(tx)
        await this.ensureDefaultMenus(tx)
        for (const definition of uniqueDefinitions) {
          await tx
            .insert(this.permissionTable)
            .values({
              code: definition.code,
              name: definition.name,
              groupCode: definition.groupCode,
              description: definition.description,
              source: AdminPermissionSource.API,
              isEnabled: true,
            })
            .onConflictDoUpdate({
              target: this.permissionTable.code,
              set: {
                name: definition.name,
                groupCode: definition.groupCode,
                description: definition.description,
                source: AdminPermissionSource.API,
                isEnabled: true,
                updatedAt: new Date(),
              },
            })
        }
        await this.retireMissingCodePermissions(
          tx,
          uniqueDefinitions.map((definition) => definition.code),
        )
        await this.grantBuiltInRoleDefaults(tx)
        await this.bumpRevision(tx)
      },
    })
    await this.cache.invalidate()
  }

  // 分页查询角色列表。
  async pageRoles(query: AdminRolePageDto) {
    const page = this.drizzle.buildPage(query)
    const conditions = [
      buildILikeCondition(this.roleTable.code, query.code),
      buildILikeCondition(this.roleTable.name, query.name),
      typeof query.isEnabled === 'boolean'
        ? eq(this.roleTable.isEnabled, query.isEnabled)
        : undefined,
    ].filter(Boolean)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const [list, totalRows] = await Promise.all([
      this.db
        .select(this.roleOutputSelect)
        .from(this.roleTable)
        .where(where)
        .orderBy(asc(this.roleTable.sortOrder), asc(this.roleTable.id))
        .limit(page.limit)
        .offset(page.offset),
      this.db.select({ count: count() }).from(this.roleTable).where(where),
    ])
    return toPageResult(
      list.map((item) => this.toRoleDto(item)),
      totalRows[0]?.count ?? 0,
      page,
    )
  }

  // 查询全部角色列表。
  async listRoles() {
    const rows = await this.db
      .select(this.roleOutputSelect)
      .from(this.roleTable)
      .orderBy(asc(this.roleTable.sortOrder), asc(this.roleTable.id))
    return rows.map((item) => this.toRoleDto(item))
  }

  // 查询角色详情和绑定关系。
  async getRoleDetail(id: number) {
    const [role] = await this.db
      .select(this.roleOutputSelect)
      .from(this.roleTable)
      .where(eq(this.roleTable.id, id))
      .limit(1)
    if (!role) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '角色不存在',
      )
    }
    const [permissionIds, menuIds] = await Promise.all([
      this.db
        .select({ id: this.rolePermissionTable.permissionId })
        .from(this.rolePermissionTable)
        .where(eq(this.rolePermissionTable.roleId, id)),
      this.db
        .select({ id: this.roleMenuTable.menuId })
        .from(this.roleMenuTable)
        .where(eq(this.roleMenuTable.roleId, id)),
    ])
    return {
      ...this.toRoleDto(role),
      permissionIds: permissionIds.map((item) => item.id),
      menuIds: menuIds.map((item) => item.id),
    }
  }

  // 创建业务角色并刷新 RBAC 版本。
  async createRole(data: AdminRoleCreateDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireRbacMutationLocksInTransaction(tx)
        await tx.insert(this.roleTable).values({
          code: data.code.trim(),
          name: data.name.trim(),
          description: this.emptyToNull(data.description),
          isEnabled: data.isEnabled ?? true,
          isSystem: false,
          sortOrder: data.sortOrder ?? 0,
        })
        await this.bumpRevision(tx)
      },
    })
    await this.cache.invalidate()
    return true
  }

  // 更新角色基础信息。
  async updateRole(data: AdminRoleUpdateDto) {
    if (Object.hasOwn(data, 'isEnabled')) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '角色启用状态请通过状态接口变更',
      )
    }
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireRbacMutationLocksInTransaction(tx)
        const role = await this.getRoleForUpdate(data.id, tx)
        await tx
          .update(this.roleTable)
          .set({
            name: data.name?.trim() ?? role.name,
            description:
              data.description === undefined
                ? role.description
                : this.emptyToNull(data.description),
            sortOrder: data.sortOrder ?? role.sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(this.roleTable.id, data.id))
        await this.bumpRevision(tx)
      },
    })
    await this.cache.invalidate()
    return true
  }

  // 删除非系统内置角色。
  async deleteRole(id: number) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireRbacMutationLocksInTransaction(tx)
        const role = await this.getRoleForUpdate(id, tx)
        this.assertMutableRole(role)
        await tx
          .delete(this.rolePermissionTable)
          .where(eq(this.rolePermissionTable.roleId, id))
        await tx
          .delete(this.roleMenuTable)
          .where(eq(this.roleMenuTable.roleId, id))
        await tx
          .delete(this.userRoleTable)
          .where(eq(this.userRoleTable.roleId, id))
        await tx.delete(this.roleTable).where(eq(this.roleTable.id, id))
        await this.bumpRevision(tx)
      },
    })
    await this.cache.invalidate()
    return true
  }

  // 单独更新角色启用状态。
  async updateRoleStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireRbacMutationLocksInTransaction(tx)
        const role = await this.getRoleForUpdate(id, tx)
        if (role.code === AdminSystemRoleCode.SUPER_ADMIN && !isEnabled) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '系统超级管理员角色不能禁用',
          )
        }
        await tx
          .update(this.roleTable)
          .set({ isEnabled, updatedAt: new Date() })
          .where(eq(this.roleTable.id, id))
        await this.bumpRevision(tx)
      },
    })
    await this.cache.invalidate()
    return true
  }

  // 绑定角色可访问的权限。
  async bindRolePermissions(data: AdminRolePermissionBindDto) {
    const permissionIds = Array.from(new Set(data.permissionIds ?? []))
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireRbacMutationLocksInTransaction(tx)
        const role = await this.getRoleForUpdate(data.id, tx)
        if (role.code === AdminSystemRoleCode.SUPER_ADMIN) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '系统超级管理员角色默认拥有全部权限',
          )
        }
        await this.assertPermissionIdsExist(permissionIds, tx)
        await tx
          .delete(this.rolePermissionTable)
          .where(eq(this.rolePermissionTable.roleId, data.id))
        if (permissionIds.length > 0) {
          await tx.insert(this.rolePermissionTable).values(
            permissionIds.map((permissionId) => ({
              roleId: data.id,
              permissionId,
            })),
          )
        }
        await this.bumpRevision(tx)
      },
    })
    await this.cache.invalidate()
    return true
  }

  // 绑定角色可访问的菜单。
  async bindRoleMenus(data: AdminRoleMenuBindDto) {
    const menuIds = Array.from(new Set(data.menuIds ?? []))
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireRbacMutationLocksInTransaction(tx)
        const role = await this.getRoleForUpdate(data.id, tx)
        if (role.code === AdminSystemRoleCode.SUPER_ADMIN) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '系统超级管理员角色默认拥有全部菜单',
          )
        }
        await this.assertMenuIdsExist(menuIds, tx)
        await tx
          .delete(this.roleMenuTable)
          .where(eq(this.roleMenuTable.roleId, data.id))
        if (menuIds.length > 0) {
          await tx.insert(this.roleMenuTable).values(
            menuIds.map((menuId) => ({
              roleId: data.id,
              menuId,
            })),
          )
        }
        await this.bumpRevision(tx)
      },
    })
    await this.cache.invalidate()
    return true
  }

  // 查询管理端权限清单。
  async listPermissions(): Promise<AdminPermissionDto[]> {
    const rows = await this.db
      .select(this.permissionOutputSelect)
      .from(this.permissionTable)
      .orderBy(
        asc(this.permissionTable.groupCode),
        asc(this.permissionTable.code),
      )
    return rows.map((item) => ({
      ...item,
      description: item.description ?? null,
    }))
  }

  // 查询完整菜单树。
  async menuTree(): Promise<AdminMenuDto[]> {
    const rows = await this.db
      .select(this.menuOutputSelect)
      .from(this.menuTable)
      .orderBy(
        asc(this.menuTable.parentId),
        asc(this.menuTable.sortOrder),
        asc(this.menuTable.id),
      )
    return this.buildMenuTree(rows.map((item) => this.toMenuDto(item)))
  }

  // 创建后台菜单。
  async createMenu(data: AdminMenuCreateDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireRbacMutationLocksInTransaction(tx)
        if (data.parentId) {
          await this.assertMenuIdsExist([data.parentId], tx)
        }
        const insertedRows = await tx
          .insert(this.menuTable)
          .values({
            ...data,
            code: data.code.trim(),
            title: data.title.trim(),
            parentId: data.parentId ?? null,
            name: this.emptyToNull(data.name),
            component: this.emptyToNull(data.component),
            redirect: this.emptyToNull(data.redirect),
            icon: this.emptyToNull(data.icon),
            externalLink: this.emptyToNull(data.externalLink),
            sortOrder: data.sortOrder ?? 0,
            isVisible: data.isVisible ?? true,
            isEnabled: data.isEnabled ?? true,
            keepAlive: data.keepAlive ?? false,
          })
          .returning({ id: this.menuTable.id })
        this.drizzle.assertAffectedRows(insertedRows, '菜单创建失败')
        await this.bumpRevision(tx)
      },
    })
    await this.cache.invalidate()
    return true
  }

  // 更新后台菜单配置。
  async updateMenu(data: AdminMenuUpdateDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireRbacMutationLocksInTransaction(tx)
        const [menu] = await tx
          .select(this.menuUpdateSelect)
          .from(this.menuTable)
          .where(eq(this.menuTable.id, data.id))
          .limit(1)
        if (!menu) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '菜单不存在',
          )
        }
        const nextParentId =
          data.parentId === undefined ? menu.parentId : data.parentId
        if (nextParentId && nextParentId === data.id) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '菜单不能挂载到自身',
          )
        }
        if (nextParentId) {
          await this.assertMenuIdsExist([nextParentId], tx)
          await this.assertMenuParentIsNotDescendant(data.id, nextParentId, tx)
        }
        const updatedRows = await tx
          .update(this.menuTable)
          .set({
            parentId: nextParentId,
            type: data.type ?? menu.type,
            title: data.title?.trim() ?? menu.title,
            path: data.path?.trim() ?? menu.path,
            name:
              data.name === undefined ? menu.name : this.emptyToNull(data.name),
            component:
              data.component === undefined
                ? menu.component
                : this.emptyToNull(data.component),
            redirect:
              data.redirect === undefined
                ? menu.redirect
                : this.emptyToNull(data.redirect),
            icon:
              data.icon === undefined ? menu.icon : this.emptyToNull(data.icon),
            sortOrder: data.sortOrder ?? menu.sortOrder,
            isVisible: data.isVisible ?? menu.isVisible,
            isEnabled: data.isEnabled ?? menu.isEnabled,
            keepAlive: data.keepAlive ?? menu.keepAlive,
            externalLink:
              data.externalLink === undefined
                ? menu.externalLink
                : this.emptyToNull(data.externalLink),
            updatedAt: new Date(),
          })
          .where(eq(this.menuTable.id, data.id))
          .returning({ id: this.menuTable.id })
        this.drizzle.assertAffectedRows(updatedRows, '菜单不存在')
        await this.bumpRevision(tx)
      },
    })
    await this.cache.invalidate()
    return true
  }

  // 删除没有子节点的菜单。
  async deleteMenu(id: number) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireRbacMutationLocksInTransaction(tx)
        await this.assertMenuIdsExist([id], tx)
        await this.assertMenuHasNoChildren(id, tx)
        await tx
          .delete(this.roleMenuTable)
          .where(eq(this.roleMenuTable.menuId, id))
        const deletedRows = await tx
          .delete(this.menuTable)
          .where(eq(this.menuTable.id, id))
          .returning({ id: this.menuTable.id })
        this.drizzle.assertAffectedRows(deletedRows, '菜单不存在')
        await this.bumpRevision(tx)
      },
    })
    await this.cache.invalidate()
    return true
  }

  // 单独更新菜单启用状态。
  async updateMenuStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireRbacMutationLocksInTransaction(tx)
        const updatedRows = await tx
          .update(this.menuTable)
          .set({ isEnabled, updatedAt: new Date() })
          .where(eq(this.menuTable.id, id))
          .returning({ id: this.menuTable.id })
        this.drizzle.assertAffectedRows(updatedRows, '菜单不存在')
        await this.bumpRevision(tx)
      },
    })
    await this.cache.invalidate()
    return true
  }

  // 拖拽调整菜单父级和排序。
  async dragReorderMenu(data: AdminMenuDragReorderDto) {
    if (data.parentId && data.parentId === data.id) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '菜单不能挂载到自身',
      )
    }
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireRbacMutationLocksInTransaction(tx)
        await this.assertMenuIdsExist([data.id], tx)
        if (data.parentId) {
          await this.assertMenuIdsExist([data.parentId], tx)
          await this.assertMenuParentIsNotDescendant(data.id, data.parentId, tx)
        }
        const updatedRows = await tx
          .update(this.menuTable)
          .set({
            parentId: data.parentId ?? null,
            sortOrder: data.sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(this.menuTable.id, data.id))
          .returning({ id: this.menuTable.id })
        this.drizzle.assertAffectedRows(updatedRows, '菜单不存在')
        await this.bumpRevision(tx)
      },
    })
    await this.cache.invalidate()
    return true
  }

  // 绑定管理员账号拥有的角色。
  async bindUserRoles(adminUserId: number, roleIds: number[]) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireRbacMutationLocksInTransaction(tx)
        await this.bindUserRolesLockedInTransaction(tx, adminUserId, roleIds)
      },
    })
    await this.cache.invalidate([adminUserId])
  }

  // 在调用方已持有 RBAC mutation 锁的事务内替换管理员角色并递增版本。
  async bindUserRolesLockedInTransaction(
    tx: AdminRbacTransaction,
    adminUserId: number,
    roleIds: number[],
  ) {
    const normalizedRoleIds = await this.normalizeRoleIds(roleIds, tx)
    await this.assertAdminUserExists(adminUserId, tx)
    await tx
      .delete(this.userRoleTable)
      .where(eq(this.userRoleTable.adminUserId, adminUserId))
    if (normalizedRoleIds.length > 0) {
      await tx.insert(this.userRoleTable).values(
        normalizedRoleIds.map((roleId) => ({
          adminUserId,
          roleId,
        })),
      )
    }
    await this.bumpRevision(tx)
  }

  // 提交事务后清理指定管理员的 RBAC 缓存。
  async invalidateUserAccess(adminUserId: number) {
    await this.cache.invalidate([adminUserId])
  }

  // 查询管理员账号的角色摘要。
  async getUserRoleSummaries(
    adminUserId: number,
  ): Promise<AdminRoleSummaryDto[]> {
    return this.getUserRoleSummariesInTransaction(this.db, adminUserId)
  }

  // 在指定事务上下文内查询管理员账号角色摘要。
  async getUserRoleSummariesInTransaction(
    tx: AdminRbacDb,
    adminUserId: number,
  ): Promise<AdminRoleSummaryDto[]> {
    const rows = await tx
      .select({
        id: this.roleTable.id,
        code: this.roleTable.code,
        name: this.roleTable.name,
        isSystem: this.roleTable.isSystem,
        isEnabled: this.roleTable.isEnabled,
      })
      .from(this.userRoleTable)
      .innerJoin(
        this.roleTable,
        eq(this.roleTable.id, this.userRoleTable.roleId),
      )
      .where(eq(this.userRoleTable.adminUserId, adminUserId))
      .orderBy(asc(this.roleTable.sortOrder), asc(this.roleTable.id))
    return rows
  }

  // 读取或构建管理员 RBAC subject 快照。
  async getSubjectSnapshot(
    adminUserId: number,
  ): Promise<AdminRbacSubjectSnapshot> {
    const revision = await this.getCurrentRevision()
    const cached = await this.cache.getSubject(adminUserId)
    if (
      cached &&
      cached.revision === revision &&
      cached.expiresAt > Date.now()
    ) {
      return cached
    }
    const snapshot = await this.buildSubjectSnapshot(adminUserId, revision)
    await this.cache.setSubject(snapshot)
    return snapshot
  }

  // 组装当前登录管理员的 RBAC 引导信息。
  async getCurrentBootstrap(adminUserId: number) {
    const snapshot = await this.getSubjectSnapshot(adminUserId)
    return {
      roleCodes: snapshot.roleCodes,
      isSuperAdmin: snapshot.isSuperAdmin,
      accessCodes: snapshot.permissionCodes,
      menus: snapshot.menus,
      revision: snapshot.revision,
      expiresAt: new Date(snapshot.expiresAt),
    }
  }

  // 判断管理员是否拥有超级管理员角色。
  async isSuperAdmin(adminUserId: number) {
    const snapshot = await this.getSubjectSnapshot(adminUserId)
    return snapshot.isSuperAdmin
  }

  // 校验移除超级管理员能力后仍至少保留一个可用超级管理员。
  async assertCanRemoveSuperAdminFromUser(adminUserId: number) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.acquireSuperAdminMutationLocksInTransaction(tx)
        await this.assertCanRemoveSuperAdminLockedInTransaction(tx, adminUserId)
      },
    })
  }

  // 在调用方已持有超级管理员完整锁并集的事务内校验最终可用人数。
  async assertCanRemoveSuperAdminLockedInTransaction(
    tx: AdminRbacTransaction,
    adminUserId: number,
  ) {
    const roles = await this.getUserRoleSummariesInTransaction(tx, adminUserId)
    if (
      !roles.some(
        (role) =>
          role.code === AdminSystemRoleCode.SUPER_ADMIN && role.isEnabled,
      )
    ) {
      return
    }
    const [{ count: otherEnabledSuperAdminCount = 0 } = { count: 0 }] = await tx
      .select({ count: count() })
      .from(this.userRoleTable)
      .innerJoin(
        this.roleTable,
        eq(this.roleTable.id, this.userRoleTable.roleId),
      )
      .innerJoin(
        this.adminUserTable,
        eq(this.adminUserTable.id, this.userRoleTable.adminUserId),
      )
      .where(
        and(
          eq(this.roleTable.code, AdminSystemRoleCode.SUPER_ADMIN),
          eq(this.roleTable.isEnabled, true),
          eq(this.adminUserTable.isEnabled, true),
          ne(this.userRoleTable.adminUserId, adminUserId),
        ),
      )
    if (otherEnabledSuperAdminCount < 1) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '至少需要保留一个可用的超级管理员',
      )
    }
  }

  // 顶层事务一次性串行化 RBAC 写入与超级管理员成员变更。
  async acquireSuperAdminMutationLocksInTransaction(tx: AdminRbacTransaction) {
    await acquireIntegrityLocks(tx, [
      exclusiveIntegrityLock(ADMIN_RBAC_RELATION_INTEGRITY_LOCKS.mutation),
      exclusiveIntegrityLock(
        ADMIN_RBAC_RELATION_INTEGRITY_LOCKS.superAdminMembership,
      ),
    ])
  }

  // 顶层事务一次性串行化普通 RBAC 关系写入。
  private async acquireRbacMutationLocksInTransaction(
    tx: AdminRbacTransaction,
  ) {
    await acquireIntegrityLocks(tx, [
      exclusiveIntegrityLock(ADMIN_RBAC_RELATION_INTEGRITY_LOCKS.mutation),
    ])
  }

  // 从数据库读取权威 RBAC 全局版本并镜像到缓存。
  private async getCurrentRevision() {
    const [row] = await this.db
      .select({ revision: this.revisionTable.revision })
      .from(this.revisionTable)
      .where(eq(this.revisionTable.code, ADMIN_RBAC_REVISION_CODE))
      .limit(1)
    if (!row || row.revision <= 0) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        'RBAC版本不可用',
      )
    }
    const revision = row.revision
    await this.cache.setRevision(revision)
    return revision
  }

  // 基于角色、权限和菜单构建 subject 快照。
  private async buildSubjectSnapshot(
    adminUserId: number,
    revision: number,
  ): Promise<AdminRbacSubjectSnapshot> {
    const roles = await this.getUserRoleSummaries(adminUserId)
    const roleIds = roles
      .filter((role) => role.isEnabled)
      .map((role) => role.id)
    const roleCodes = roles
      .filter((role) => role.isEnabled)
      .map((role) => role.code)
    const isSuperAdmin = roleCodes.includes(AdminSystemRoleCode.SUPER_ADMIN)
    const [permissionCodes, menuRows] = await Promise.all([
      isSuperAdmin
        ? this.loadAllPermissionCodes()
        : this.loadPermissionCodesByRoles(roleIds),
      isSuperAdmin ? this.loadAllMenus() : this.loadMenusByRoles(roleIds),
    ])
    const menus = this.buildMenuTree(
      menuRows.map((item) => this.toCurrentMenuDto(item)),
    )
    return {
      adminUserId,
      revision,
      roleCodes,
      isSuperAdmin,
      permissionCodes,
      menuCodes: Array.from(new Set(menuRows.map((item) => item.code))),
      menus,
      expiresAt: Date.now() + this.cache.getSnapshotTtlMs(),
    }
  }

  // 查询所有启用权限编码。
  private async loadAllPermissionCodes() {
    const rows = await this.db
      .select({ code: this.permissionTable.code })
      .from(this.permissionTable)
      .where(eq(this.permissionTable.isEnabled, true))
    return rows.map((item) => item.code)
  }

  // 查询指定角色拥有的启用权限编码。
  private async loadPermissionCodesByRoles(roleIds: number[]) {
    if (roleIds.length === 0) {
      return []
    }
    const rows = await this.db
      .select({ code: this.permissionTable.code })
      .from(this.rolePermissionTable)
      .innerJoin(
        this.permissionTable,
        eq(this.permissionTable.id, this.rolePermissionTable.permissionId),
      )
      .where(
        and(
          inArray(this.rolePermissionTable.roleId, roleIds),
          eq(this.permissionTable.isEnabled, true),
        ),
      )
    return Array.from(new Set(rows.map((item) => item.code)))
  }

  // 查询所有启用且可见的菜单。
  private async loadAllMenus(): Promise<AdminCurrentMenuRow[]> {
    return this.db
      .select(this.currentMenuSelect)
      .from(this.menuTable)
      .where(
        and(
          eq(this.menuTable.isEnabled, true),
          eq(this.menuTable.isVisible, true),
        ),
      )
      .orderBy(
        asc(this.menuTable.parentId),
        asc(this.menuTable.sortOrder),
        asc(this.menuTable.id),
      )
  }

  // 查询指定角色拥有的启用且可见菜单。
  private async loadMenusByRoles(
    roleIds: number[],
  ): Promise<AdminCurrentMenuRow[]> {
    if (roleIds.length === 0) {
      return []
    }
    const roleIdList = sql.join(
      roleIds.map((roleId) => sql`${roleId}`),
      sql`, `,
    )
    // 使用递归 CTE 读取授权菜单及祖先目录，避免只绑定子菜单时生成孤儿菜单树。
    const result = await this.db.execute(sql`
      WITH RECURSIVE authorized_menu AS (
        SELECT
          menu.id,
          menu.code,
          menu.parent_id,
          menu.title,
          menu.path,
          menu.name,
          menu.component,
          menu.redirect,
          menu.icon,
          menu.sort_order,
          menu.is_visible,
          menu.keep_alive
        FROM admin_role_menu role_menu
        INNER JOIN admin_menu menu ON menu.id = role_menu.menu_id
        WHERE
          role_menu.role_id IN (${roleIdList})
          AND menu.is_enabled = true
          AND menu.is_visible = true

        UNION

        SELECT
          parent.id,
          parent.code,
          parent.parent_id,
          parent.title,
          parent.path,
          parent.name,
          parent.component,
          parent.redirect,
          parent.icon,
          parent.sort_order,
          parent.is_visible,
          parent.keep_alive
        FROM admin_menu parent
        INNER JOIN authorized_menu child ON child.parent_id = parent.id
        WHERE
          parent.is_enabled = true
          AND parent.is_visible = true
      )
      SELECT
        id,
        code,
        parent_id AS "parentId",
        title,
        path,
        name,
        component,
        redirect,
        icon,
        sort_order AS "sortOrder",
        is_visible AS "isVisible",
        keep_alive AS "keepAlive"
      FROM authorized_menu
      ORDER BY parent_id ASC NULLS FIRST, sort_order ASC, id ASC
    `)
    return this.extractExecutedRows<AdminCurrentMenuRow>(result)
  }

  // 校验权限元数据编码唯一且必填字段完整。
  private assertUniqueDefinitions(definitions: AdminPermissionDefinition[]) {
    const byCode = new Map<string, AdminPermissionDefinition>()
    for (const definition of definitions) {
      if (!definition.code || !definition.groupCode || !definition.name) {
        throw new Error(`Invalid admin permission metadata: ${definition.code}`)
      }
      const existed = byCode.get(definition.code)
      if (existed) {
        throw new Error(
          `Duplicate admin permission code ${definition.code}: ${existed.controllerName}.${existed.handlerName} and ${definition.controllerName}.${definition.handlerName}`,
        )
      }
      byCode.set(definition.code, definition)
    }
    return [...byCode.values()]
  }

  // 确保 RBAC 全局版本单例行存在。
  private async ensureRevision(tx: AdminRbacTransaction) {
    await tx
      .insert(this.revisionTable)
      .values({ code: ADMIN_RBAC_REVISION_CODE, revision: 1 })
      .onConflictDoNothing()
  }

  // 幂等补齐系统内置角色。
  private async ensureBuiltInRoles(tx: AdminRbacTransaction) {
    await tx
      .insert(this.roleTable)
      .values({
        code: AdminSystemRoleCode.SUPER_ADMIN,
        name: '超级管理员',
        description: '系统内置超级管理员，默认拥有全部权限和菜单',
        isSystem: true,
        isEnabled: true,
        sortOrder: 1,
      })
      .onConflictDoNothing()
    await tx
      .insert(this.roleTable)
      .values({
        code: AdminSystemRoleCode.NORMAL_ADMIN,
        name: '普通管理员',
        description: '系统内置普通管理员，仅保留基础自助能力',
        isSystem: true,
        isEnabled: true,
        sortOrder: 2,
      })
      .onConflictDoNothing()
  }

  // 首次 bootstrap 时补齐默认菜单并记录完成时间。
  private async ensureDefaultMenus(tx: AdminRbacTransaction) {
    const [revision] = await tx
      .select({ menuSeededAt: this.revisionTable.menuSeededAt })
      .from(this.revisionTable)
      .where(eq(this.revisionTable.code, ADMIN_RBAC_REVISION_CODE))
      .limit(1)
    if (revision?.menuSeededAt) {
      return
    }
    const menuIdsByCode = await this.seedMissingDefaultMenus(tx)
    await this.normalizeDefaultMenuParents(tx, menuIdsByCode)
    await this.markDefaultMenusSeeded(tx)
  }

  // 插入缺失的默认菜单并返回编码到 id 的映射。
  private async seedMissingDefaultMenus(tx: AdminRbacTransaction) {
    const menuIdsByCode = new Map<string, number>()
    const existingRows = await tx
      .select({ id: this.menuTable.id, code: this.menuTable.code })
      .from(this.menuTable)
    for (const item of existingRows) {
      menuIdsByCode.set(item.code, item.id)
    }
    for (const menu of ADMIN_DEFAULT_MENUS) {
      let parentId: number | null = null
      if (menu.parentCode) {
        const parentMenuId = menuIdsByCode.get(menu.parentCode)
        if (parentMenuId === undefined) {
          throw new Error(
            `Default admin menu parent is missing: ${menu.parentCode}`,
          )
        }
        parentId = parentMenuId
      }
      const [row] = await tx
        .insert(this.menuTable)
        .values({
          code: menu.code,
          parentId,
          type: menu.type,
          title: menu.title,
          path: menu.path,
          name: menu.name,
          component: menu.component,
          redirect: menu.redirect,
          icon: menu.icon,
          sortOrder: menu.sortOrder,
          isVisible: menu.isVisible ?? true,
          isEnabled: true,
          keepAlive: menu.keepAlive ?? false,
        })
        .onConflictDoNothing()
        .returning({ id: this.menuTable.id, code: this.menuTable.code })
      if (row) {
        menuIdsByCode.set(row.code, row.id)
        continue
      }
      const [existing] = await tx
        .select({ id: this.menuTable.id, code: this.menuTable.code })
        .from(this.menuTable)
        .where(eq(this.menuTable.code, menu.code))
        .limit(1)
      if (!existing) {
        throw new Error(`Default admin menu is missing: ${menu.code}`)
      }
      menuIdsByCode.set(existing.code, existing.id)
    }
    return menuIdsByCode
  }

  // 首次种子阶段修正默认菜单父子关系。
  private async normalizeDefaultMenuParents(
    tx: AdminRbacTransaction,
    menuIdsByCode: ReadonlyMap<string, number>,
  ) {
    for (const menu of ADMIN_DEFAULT_MENUS) {
      const menuId = menuIdsByCode.get(menu.code)
      if (menuId === undefined) {
        throw new Error(`Default admin menu is missing: ${menu.code}`)
      }
      let parentId: number | null = null
      if (menu.parentCode) {
        const parentMenuId = menuIdsByCode.get(menu.parentCode)
        if (parentMenuId === undefined) {
          throw new Error(
            `Default admin menu parent is missing: ${menu.parentCode}`,
          )
        }
        parentId = parentMenuId
      }
      const updatedRows = await tx
        .update(this.menuTable)
        .set({ parentId, updatedAt: new Date() })
        .where(eq(this.menuTable.id, menuId))
        .returning({ id: this.menuTable.id })
      this.drizzle.assertAffectedRows(updatedRows, '默认菜单不存在')
    }
  }

  // 标记默认菜单首次种子已经完成。
  private async markDefaultMenusSeeded(tx: AdminRbacTransaction) {
    const updatedRows = await tx
      .update(this.revisionTable)
      .set({ menuSeededAt: new Date(), updatedAt: new Date() })
      .where(eq(this.revisionTable.code, ADMIN_RBAC_REVISION_CODE))
      .returning({ code: this.revisionTable.code })
    this.drizzle.assertAffectedRows(updatedRows, 'RBAC版本不存在')
  }

  // 幂等授予系统内置角色的默认权限和菜单。
  private async grantBuiltInRoleDefaults(tx: AdminRbacTransaction) {
    const roles = await tx
      .select({ id: this.roleTable.id, code: this.roleTable.code })
      .from(this.roleTable)
      .where(
        inArray(this.roleTable.code, [
          AdminSystemRoleCode.SUPER_ADMIN,
          AdminSystemRoleCode.NORMAL_ADMIN,
        ]),
      )
    const superRoleId = roles.find(
      (role) => role.code === AdminSystemRoleCode.SUPER_ADMIN,
    )?.id
    const normalRoleId = roles.find(
      (role) => role.code === AdminSystemRoleCode.NORMAL_ADMIN,
    )?.id
    if (!superRoleId || !normalRoleId) {
      throw new Error('Built-in RBAC roles are missing')
    }
    const permissions = await tx
      .select({ id: this.permissionTable.id, code: this.permissionTable.code })
      .from(this.permissionTable)
      .where(eq(this.permissionTable.isEnabled, true))
    if (permissions.length > 0) {
      await tx
        .insert(this.rolePermissionTable)
        .values(
          permissions.map((permission) => ({
            roleId: superRoleId,
            permissionId: permission.id,
          })),
        )
        .onConflictDoNothing()
      const baseline = permissions.filter((permission) =>
        ADMIN_BASELINE_PERMISSION_CODE_SET.has(permission.code),
      )
      if (baseline.length > 0) {
        await tx
          .insert(this.rolePermissionTable)
          .values(
            baseline.map((permission) => ({
              roleId: normalRoleId,
              permissionId: permission.id,
            })),
          )
          .onConflictDoNothing()
      }
    }
    const menus = await tx
      .select({ id: this.menuTable.id, code: this.menuTable.code })
      .from(this.menuTable)
      .where(eq(this.menuTable.isEnabled, true))
    if (menus.length > 0) {
      await tx
        .insert(this.roleMenuTable)
        .values(menus.map((menu) => ({ roleId: superRoleId, menuId: menu.id })))
        .onConflictDoNothing()
      const profileMenu = menus.find((menu) => menu.code === 'system_profile')
      if (profileMenu) {
        await tx
          .insert(this.roleMenuTable)
          .values({ roleId: normalRoleId, menuId: profileMenu.id })
          .onConflictDoNothing()
      }
    }
  }

  // 停用代码中已不存在的装饰器权限。
  private async retireMissingCodePermissions(
    tx: AdminRbacTransaction,
    activeCodes: string[],
  ) {
    const where =
      activeCodes.length > 0
        ? and(
            eq(this.permissionTable.source, AdminPermissionSource.API),
            eq(this.permissionTable.isEnabled, true),
            notInArray(this.permissionTable.code, activeCodes),
          )
        : and(
            eq(this.permissionTable.source, AdminPermissionSource.API),
            eq(this.permissionTable.isEnabled, true),
          )
    const retiredPermissions = await tx
      .update(this.permissionTable)
      .set({ isEnabled: false, updatedAt: new Date() })
      .where(where)
      .returning({ id: this.permissionTable.id })
    const retiredPermissionIds = retiredPermissions.map((item) => item.id)
    if (retiredPermissionIds.length > 0) {
      await tx
        .delete(this.rolePermissionTable)
        .where(
          inArray(this.rolePermissionTable.permissionId, retiredPermissionIds),
        )
    }
  }

  // 原子递增 RBAC 全局版本。
  private async bumpRevision(tx: AdminRbacTransaction) {
    const updatedRows = await tx
      .update(this.revisionTable)
      .set({
        revision: sql<number>`${this.revisionTable.revision} + 1`.mapWith(
          Number,
        ),
        updatedAt: new Date(),
      })
      .where(eq(this.revisionTable.code, ADMIN_RBAC_REVISION_CODE))
      .returning({ revision: this.revisionTable.revision })
    this.drizzle.assertAffectedRows(updatedRows, 'RBAC版本不存在')
  }

  // 规范化账号角色集合，空集合直接拒绝。
  private async normalizeRoleIds(
    roleIds: number[] | undefined,
    tx: AdminRbacTransaction,
  ) {
    const normalized = Array.from(new Set(roleIds ?? []))
    if (normalized.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '至少选择一个角色',
      )
    }
    await this.assertRoleIdsExist(normalized, tx)
    return normalized
  }

  // 校验角色 id 集合都存在。
  private async assertRoleIdsExist(ids: number[], tx: AdminRbacTransaction) {
    if (ids.length === 0) {
      return
    }
    const rows = await tx
      .select({ id: this.roleTable.id })
      .from(this.roleTable)
      .where(inArray(this.roleTable.id, ids))
    if (rows.length !== ids.length) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '角色不存在',
      )
    }
  }

  // 管理员角色关系写入前，在取得 RBAC 完整性锁后复核父账号仍存在。
  private async assertAdminUserExists(id: number, tx: AdminRbacTransaction) {
    const [user] = await tx
      .select({ id: this.adminUserTable.id })
      .from(this.adminUserTable)
      .where(eq(this.adminUserTable.id, id))
      .limit(1)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
  }

  // 校验权限 id 集合都存在。
  private async assertPermissionIdsExist(
    ids: number[],
    tx: AdminRbacTransaction,
  ) {
    if (ids.length === 0) {
      return
    }
    const rows = await tx
      .select({ id: this.permissionTable.id })
      .from(this.permissionTable)
      .where(inArray(this.permissionTable.id, ids))
    if (rows.length !== ids.length) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '权限不存在',
      )
    }
  }

  // 校验菜单 id 集合都存在。
  private async assertMenuIdsExist(ids: number[], tx: AdminRbacTransaction) {
    if (ids.length === 0) {
      return
    }
    const rows = await tx
      .select({ id: this.menuTable.id })
      .from(this.menuTable)
      .where(inArray(this.menuTable.id, ids))
    if (rows.length !== ids.length) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '菜单不存在',
      )
    }
  }

  // 删除菜单前确保没有子菜单。
  private async assertMenuHasNoChildren(id: number, tx: AdminRbacTransaction) {
    const [{ count: childCount = 0 } = { count: 0 }] = await tx
      .select({ count: count() })
      .from(this.menuTable)
      .where(eq(this.menuTable.parentId, id))
    if (childCount > 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '请先删除或迁移子菜单',
      )
    }
  }

  // 防止菜单被移动到自己的后代节点下。
  private async assertMenuParentIsNotDescendant(
    id: number,
    parentId: number,
    tx: AdminRbacTransaction,
  ) {
    const result = await tx.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id
        FROM admin_menu
        WHERE parent_id = ${id}
        UNION ALL
        SELECT child.id
        FROM admin_menu child
        INNER JOIN descendants parent ON child.parent_id = parent.id
      )
      SELECT id
      FROM descendants
      WHERE id = ${parentId}
      LIMIT 1
    `)
    const [descendant] = this.extractExecutedRows<{ id: number }>(result)
    if (descendant) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '菜单不能挂载到自身的子菜单下',
      )
    }
  }

  // 查询角色并作为写入前校验依据。
  private async getRoleForUpdate(id: number, tx: AdminRbacTransaction) {
    const [role] = await tx
      .select(this.roleMutationSelect)
      .from(this.roleTable)
      .where(eq(this.roleTable.id, id))
      .limit(1)
    if (!role) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '角色不存在',
      )
    }
    return role
  }

  // 系统角色禁止删除。
  private assertMutableRole(role: AdminMutableRole) {
    if (role.isSystem || role.code === AdminSystemRoleCode.SUPER_ADMIN) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '系统内置角色不能删除',
      )
    }
  }

  // 映射角色输出 DTO。
  private toRoleDto(role: AdminRoleRow): AdminRoleDto {
    return {
      ...role,
      description: role.description ?? null,
    }
  }

  // 映射后台菜单输出 DTO。
  private toMenuDto(menu: AdminMenuRow): AdminMenuDto {
    return {
      id: menu.id,
      code: menu.code,
      parentId: menu.parentId,
      type: menu.type,
      title: menu.title,
      path: menu.path,
      name: menu.name ?? null,
      component: menu.component ?? null,
      redirect: menu.redirect ?? null,
      icon: menu.icon ?? null,
      sortOrder: menu.sortOrder,
      isVisible: menu.isVisible,
      isEnabled: menu.isEnabled,
      keepAlive: menu.keepAlive,
      externalLink: menu.externalLink ?? null,
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
      children: [],
    }
  }

  // 映射当前登录管理员菜单 DTO。
  private toCurrentMenuDto(menu: AdminCurrentMenuRow) {
    return {
      id: menu.id,
      code: menu.code,
      title: menu.title,
      path: menu.path,
      name: menu.name ?? null,
      component: menu.component ?? null,
      redirect: menu.redirect ?? null,
      icon: menu.icon ?? null,
      sortOrder: menu.sortOrder,
      isVisible: menu.isVisible,
      keepAlive: menu.keepAlive,
      parentId: menu.parentId,
      children: [],
    }
  }

  // 根据 parentId 组装并排序菜单树。
  private buildMenuTree<T extends AdminMenuTreeNode<T>>(rows: T[]): T[] {
    const byId = new Map<number, T>()
    const roots: T[] = []
    for (const row of rows) {
      if (!byId.has(row.id)) {
        row.children = []
        byId.set(row.id, row)
      }
    }
    for (const row of byId.values()) {
      if (row.parentId === null) {
        roots.push(row)
      } else if (row.parentId !== row.id && byId.has(row.parentId)) {
        byId.get(row.parentId)!.children.push(row)
      }
    }
    const sortTree = (items: T[]) => {
      items.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      for (const item of items) {
        sortTree(item.children)
      }
    }
    sortTree(roots)
    return roots
  }

  // 校验 Drizzle execute 返回结构并提取 rows。
  private extractExecutedRows<T>(
    result: AdminExecutedRowsResult<T> | object | null | undefined,
  ) {
    if (!result || typeof result !== 'object' || !('rows' in result)) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        'RBAC原生查询结果结构异常',
      )
    }
    const rows = result.rows
    if (!Array.isArray(rows)) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        'RBAC原生查询结果结构异常',
      )
    }
    return rows
  }

  // 将空字符串统一收敛为 null。
  private emptyToNull(value: string | null | undefined) {
    const normalized = value?.trim()
    return normalized || null
  }
}
