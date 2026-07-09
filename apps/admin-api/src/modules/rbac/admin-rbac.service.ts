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
} from './admin-rbac.type'
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'
import {
  ADMIN_BASELINE_PERMISSION_CODES,
  ADMIN_RBAC_REVISION_CODE,
  AdminPermissionSource,
  AdminSystemRoleCode,
} from '@libs/identity/admin-rbac.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { ForbiddenException, Injectable } from '@nestjs/common'
import { and, asc, count, eq, inArray, ne, notInArray, sql } from 'drizzle-orm'
import { AdminRbacCacheService } from './admin-rbac-cache.service'
import { ADMIN_DEFAULT_MENUS } from './admin-rbac.defaults'

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
    await this.drizzle.withTransaction(async (tx) => {
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
        .select()
        .from(this.roleTable)
        .where(where)
        .orderBy(asc(this.roleTable.sortOrder), asc(this.roleTable.id))
        .limit(page.limit)
        .offset(page.offset),
      this.db.select({ count: count() }).from(this.roleTable).where(where),
    ])
    return toPageResult(list.map((item) => this.toRoleDto(item)), totalRows[0]?.count ?? 0, page)
  }

  // 查询全部角色列表。
  async listRoles() {
    const rows = await this.db
      .select()
      .from(this.roleTable)
      .orderBy(asc(this.roleTable.sortOrder), asc(this.roleTable.id))
    return rows.map((item) => this.toRoleDto(item))
  }

  // 查询角色详情和绑定关系。
  async getRoleDetail(id: number) {
    const [role] = await this.db
      .select()
      .from(this.roleTable)
      .where(eq(this.roleTable.id, id))
      .limit(1)
    if (!role) {
      throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, '角色不存在')
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
    await this.drizzle.withTransaction(async (tx) => {
      await tx.insert(this.roleTable).values({
        code: data.code.trim(),
        name: data.name.trim(),
        description: this.emptyToNull(data.description),
        isEnabled: data.isEnabled ?? true,
        isSystem: false,
        sortOrder: data.sortOrder ?? 0,
      })
      await this.bumpRevision(tx)
    })
    await this.cache.invalidate()
    return true
  }

  // 更新角色基础信息。
  async updateRole(data: AdminRoleUpdateDto) {
    const role = await this.getRoleForUpdate(data.id)
    if (Object.hasOwn(data, 'isEnabled')) {
      throw new ForbiddenException('角色启用状态请通过状态接口变更')
    }
    await this.drizzle.withTransaction(async (tx) => {
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
    })
    await this.cache.invalidate()
    return true
  }

  // 删除非系统内置角色。
  async deleteRole(id: number) {
    const role = await this.getRoleForUpdate(id)
    this.assertMutableRole(role)
    await this.drizzle.withTransaction(async (tx) => {
      await tx
        .delete(this.rolePermissionTable)
        .where(eq(this.rolePermissionTable.roleId, id))
      await tx.delete(this.roleMenuTable).where(eq(this.roleMenuTable.roleId, id))
      await tx.delete(this.userRoleTable).where(eq(this.userRoleTable.roleId, id))
      await tx.delete(this.roleTable).where(eq(this.roleTable.id, id))
      await this.bumpRevision(tx)
    })
    await this.cache.invalidate()
    return true
  }

  // 单独更新角色启用状态。
  async updateRoleStatus(id: number, isEnabled: boolean) {
    const role = await this.getRoleForUpdate(id)
    if (role.code === AdminSystemRoleCode.SUPER_ADMIN && !isEnabled) {
      throw new ForbiddenException('系统超级管理员角色不能禁用')
    }
    await this.drizzle.withTransaction(async (tx) => {
      await tx
        .update(this.roleTable)
        .set({ isEnabled, updatedAt: new Date() })
        .where(eq(this.roleTable.id, id))
      await this.bumpRevision(tx)
    })
    await this.cache.invalidate()
    return true
  }

  // 绑定角色可访问的权限。
  async bindRolePermissions(data: AdminRolePermissionBindDto) {
    const role = await this.getRoleForUpdate(data.id)
    if (role.code === AdminSystemRoleCode.SUPER_ADMIN) {
      throw new ForbiddenException('系统超级管理员角色默认拥有全部权限')
    }
    const permissionIds = Array.from(new Set(data.permissionIds ?? []))
    await this.assertPermissionIdsExist(permissionIds)
    await this.drizzle.withTransaction(async (tx) => {
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
    })
    await this.cache.invalidate()
    return true
  }

  // 绑定角色可访问的菜单。
  async bindRoleMenus(data: AdminRoleMenuBindDto) {
    const role = await this.getRoleForUpdate(data.id)
    if (role.code === AdminSystemRoleCode.SUPER_ADMIN) {
      throw new ForbiddenException('系统超级管理员角色默认拥有全部菜单')
    }
    const menuIds = Array.from(new Set(data.menuIds ?? []))
    await this.assertMenuIdsExist(menuIds)
    await this.drizzle.withTransaction(async (tx) => {
      await tx.delete(this.roleMenuTable).where(eq(this.roleMenuTable.roleId, data.id))
      if (menuIds.length > 0) {
        await tx.insert(this.roleMenuTable).values(
          menuIds.map((menuId) => ({
            roleId: data.id,
            menuId,
          })),
        )
      }
      await this.bumpRevision(tx)
    })
    await this.cache.invalidate()
    return true
  }

  // 查询管理端权限清单。
  async listPermissions(): Promise<AdminPermissionDto[]> {
    const rows = await this.db
      .select()
      .from(this.permissionTable)
      .orderBy(asc(this.permissionTable.groupCode), asc(this.permissionTable.code))
    return rows.map((item) => ({
      ...item,
      description: item.description ?? null,
    }))
  }

  // 查询完整菜单树。
  async menuTree(): Promise<AdminMenuDto[]> {
    const rows = await this.db
      .select()
      .from(this.menuTable)
      .orderBy(asc(this.menuTable.parentId), asc(this.menuTable.sortOrder), asc(this.menuTable.id))
    return this.buildMenuTree(rows.map((item) => this.toMenuDto(item)))
  }

  // 创建后台菜单。
  async createMenu(data: AdminMenuCreateDto) {
    if (data.parentId) {
      await this.assertMenuIdsExist([data.parentId])
    }
    await this.drizzle.withTransaction(async (tx) => {
      await tx.insert(this.menuTable).values({
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
      await this.bumpRevision(tx)
    })
    await this.cache.invalidate()
    return true
  }

  // 更新后台菜单配置。
  async updateMenu(data: AdminMenuUpdateDto) {
    const [menu] = await this.db
      .select()
      .from(this.menuTable)
      .where(eq(this.menuTable.id, data.id))
      .limit(1)
    if (!menu) {
      throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, '菜单不存在')
    }
    const nextParentId = data.parentId === undefined ? menu.parentId : data.parentId
    if (nextParentId && nextParentId === data.id) {
      throw new BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED, '菜单不能挂载到自身')
    }
    if (nextParentId) {
      await this.assertMenuIdsExist([nextParentId])
      await this.assertMenuParentIsNotDescendant(data.id, nextParentId)
    }
    await this.drizzle.withTransaction(async (tx) => {
      await tx
        .update(this.menuTable)
        .set({
          parentId: nextParentId,
          type: data.type ?? menu.type,
          title: data.title?.trim() ?? menu.title,
          path: data.path?.trim() ?? menu.path,
          name: data.name === undefined ? menu.name : this.emptyToNull(data.name),
          component:
            data.component === undefined
              ? menu.component
              : this.emptyToNull(data.component),
          redirect:
            data.redirect === undefined
              ? menu.redirect
              : this.emptyToNull(data.redirect),
          icon: data.icon === undefined ? menu.icon : this.emptyToNull(data.icon),
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
      await this.bumpRevision(tx)
    })
    await this.cache.invalidate()
    return true
  }

  // 删除没有子节点的菜单。
  async deleteMenu(id: number) {
    await this.assertMenuIdsExist([id])
    await this.assertMenuHasNoChildren(id)
    await this.drizzle.withTransaction(async (tx) => {
      await tx.delete(this.roleMenuTable).where(eq(this.roleMenuTable.menuId, id))
      await tx.delete(this.menuTable).where(eq(this.menuTable.id, id))
      await this.bumpRevision(tx)
    })
    await this.cache.invalidate()
    return true
  }

  // 单独更新菜单启用状态。
  async updateMenuStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withTransaction(async (tx) => {
      await tx
        .update(this.menuTable)
        .set({ isEnabled, updatedAt: new Date() })
        .where(eq(this.menuTable.id, id))
      await this.bumpRevision(tx)
    })
    await this.cache.invalidate()
    return true
  }

  // 拖拽调整菜单父级和排序。
  async dragReorderMenu(data: AdminMenuDragReorderDto) {
    if (data.parentId && data.parentId === data.id) {
      throw new BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED, '菜单不能挂载到自身')
    }
    if (data.parentId) {
      await this.assertMenuIdsExist([data.parentId])
      await this.assertMenuParentIsNotDescendant(data.id, data.parentId)
    }
    await this.drizzle.withTransaction(async (tx) => {
      await tx
        .update(this.menuTable)
        .set({
          parentId: data.parentId ?? null,
          sortOrder: data.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(this.menuTable.id, data.id))
      await this.bumpRevision(tx)
    })
    await this.cache.invalidate()
    return true
  }

  // 绑定管理员账号拥有的角色。
  async bindUserRoles(adminUserId: number, roleIds: number[]) {
    const normalizedRoleIds = await this.normalizeRoleIds(roleIds)
    await this.drizzle.withTransaction(async (tx) => {
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
    })
    await this.cache.invalidate([adminUserId])
  }

  // 查询管理员账号的角色摘要。
  async getUserRoleSummaries(adminUserId: number): Promise<AdminRoleSummaryDto[]> {
    const rows = await this.db
      .select({
        id: this.roleTable.id,
        code: this.roleTable.code,
        name: this.roleTable.name,
        isSystem: this.roleTable.isSystem,
        isEnabled: this.roleTable.isEnabled,
      })
      .from(this.userRoleTable)
      .innerJoin(this.roleTable, eq(this.roleTable.id, this.userRoleTable.roleId))
      .where(eq(this.userRoleTable.adminUserId, adminUserId))
      .orderBy(asc(this.roleTable.sortOrder), asc(this.roleTable.id))
    return rows
  }

  // 读取或构建管理员 RBAC subject 快照。
  async getSubjectSnapshot(adminUserId: number): Promise<AdminRbacSubjectSnapshot> {
    const revision = await this.getCurrentRevision()
    const cached = await this.cache.getSubject(adminUserId)
    if (cached && cached.revision === revision && cached.expiresAt > Date.now()) {
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
    const roles = await this.getUserRoleSummaries(adminUserId)
    if (
      !roles.some(
        (role) => role.code === AdminSystemRoleCode.SUPER_ADMIN && role.isEnabled,
      )
    ) {
      return
    }
    const [{ count: otherEnabledSuperAdminCount = 0 } = { count: 0 }] = await this.db
      .select({ count: count() })
      .from(this.userRoleTable)
      .innerJoin(this.roleTable, eq(this.roleTable.id, this.userRoleTable.roleId))
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
      throw new ForbiddenException('至少需要保留一个可用的超级管理员')
    }
  }

  // 读取 RBAC 全局版本并写入缓存。
  private async getCurrentRevision() {
    const cached = await this.cache.getRevision()
    if (typeof cached === 'number' && cached > 0) {
      return cached
    }
    await this.ensureRevision(this.db)
    const [row] = await this.db
      .select({ revision: this.revisionTable.revision })
      .from(this.revisionTable)
      .where(eq(this.revisionTable.code, ADMIN_RBAC_REVISION_CODE))
      .limit(1)
    const revision = row?.revision ?? 1
    await this.cache.setRevision(revision)
    return revision
  }

  // 基于角色、权限和菜单构建 subject 快照。
  private async buildSubjectSnapshot(
    adminUserId: number,
    revision: number,
  ): Promise<AdminRbacSubjectSnapshot> {
    const roles = await this.getUserRoleSummaries(adminUserId)
    const roleIds = roles.filter((role) => role.isEnabled).map((role) => role.id)
    const roleCodes = roles.filter((role) => role.isEnabled).map((role) => role.code)
    const isSuperAdmin = roleCodes.includes(AdminSystemRoleCode.SUPER_ADMIN)
    const [permissionCodes, menuRows] = await Promise.all([
      isSuperAdmin
        ? this.loadAllPermissionCodes()
        : this.loadPermissionCodesByRoles(roleIds),
      isSuperAdmin ? this.loadAllMenus() : this.loadMenusByRoles(roleIds),
    ])
    const menus = this.buildMenuTree(menuRows.map((item) => this.toCurrentMenuDto(item)))
    return {
      adminUserId,
      revision,
      roleCodes,
      isSuperAdmin,
      permissionCodes,
      menuCodes: menuRows.map((item) => item.code),
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
  private async loadAllMenus() {
    return this.db
      .select()
      .from(this.menuTable)
      .where(and(eq(this.menuTable.isEnabled, true), eq(this.menuTable.isVisible, true)))
      .orderBy(asc(this.menuTable.parentId), asc(this.menuTable.sortOrder), asc(this.menuTable.id))
  }

  // 查询指定角色拥有的启用且可见菜单。
  private async loadMenusByRoles(roleIds: number[]) {
    if (roleIds.length === 0) {
      return []
    }
    return this.db
      .select({
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
      })
      .from(this.roleMenuTable)
      .innerJoin(this.menuTable, eq(this.menuTable.id, this.roleMenuTable.menuId))
      .where(
        and(
          inArray(this.roleMenuTable.roleId, roleIds),
          eq(this.menuTable.isEnabled, true),
          eq(this.menuTable.isVisible, true),
        ),
      )
      .orderBy(asc(this.menuTable.parentId), asc(this.menuTable.sortOrder), asc(this.menuTable.id))
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
  private async ensureRevision(tx: AdminRbacDb) {
    await tx
      .insert(this.revisionTable)
      .values({ code: ADMIN_RBAC_REVISION_CODE, revision: 1 })
      .onConflictDoNothing()
  }

  // 停用代码中已不存在的装饰器权限。
  private async retireMissingCodePermissions(tx: AdminRbacDb, activeCodes: string[]) {
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
        .where(inArray(this.rolePermissionTable.permissionId, retiredPermissionIds))
    }
  }

  // 幂等补齐系统内置角色。
  private async ensureBuiltInRoles(tx: AdminRbacDb) {
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
  private async ensureDefaultMenus(tx: AdminRbacDb) {
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
  private async seedMissingDefaultMenus(tx: AdminRbacDb) {
    const inserted = new Map<string, number>()
    const existingRows = await tx
      .select({ id: this.menuTable.id, code: this.menuTable.code })
      .from(this.menuTable)
    for (const item of existingRows) {
      inserted.set(item.code, item.id)
    }
    for (const menu of ADMIN_DEFAULT_MENUS) {
      let parentId: number | null = null
      if (menu.parentCode) {
        const parentMenuId = inserted.get(menu.parentCode)
        if (parentMenuId === undefined) {
          throw new Error(`Default admin menu parent is missing: ${menu.parentCode}`)
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
        inserted.set(row.code, row.id)
      } else {
        const [existing] = await tx
          .select({ id: this.menuTable.id, code: this.menuTable.code })
          .from(this.menuTable)
          .where(eq(this.menuTable.code, menu.code))
          .limit(1)
        if (existing) {
          inserted.set(existing.code, existing.id)
        }
      }
    }
    return inserted
  }

  // 首次种子阶段修正默认菜单父子关系。
  private async normalizeDefaultMenuParents(
    tx: AdminRbacDb,
    menuIdsByCode: Map<string, number>,
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
          throw new Error(`Default admin menu parent is missing: ${menu.parentCode}`)
        }
        parentId = parentMenuId
      }
      await tx
        .update(this.menuTable)
        .set({ parentId, updatedAt: new Date() })
        .where(eq(this.menuTable.id, menuId))
    }
  }

  // 标记默认菜单首次种子已经完成。
  private async markDefaultMenusSeeded(tx: AdminRbacDb) {
    await tx
      .update(this.revisionTable)
      .set({ menuSeededAt: new Date(), updatedAt: new Date() })
      .where(eq(this.revisionTable.code, ADMIN_RBAC_REVISION_CODE))
  }

  // 幂等授予系统内置角色的默认权限和菜单。
  private async grantBuiltInRoleDefaults(tx: AdminRbacDb) {
    const roles = await tx
      .select({ id: this.roleTable.id, code: this.roleTable.code })
      .from(this.roleTable)
      .where(
        inArray(this.roleTable.code, [
          AdminSystemRoleCode.SUPER_ADMIN,
          AdminSystemRoleCode.NORMAL_ADMIN,
        ]),
      )
    const superRoleId = roles.find((role) => role.code === AdminSystemRoleCode.SUPER_ADMIN)?.id
    const normalRoleId = roles.find((role) => role.code === AdminSystemRoleCode.NORMAL_ADMIN)?.id
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
        ADMIN_BASELINE_PERMISSION_CODES.includes(permission.code as never),
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

  // 原子递增 RBAC 全局版本。
  private async bumpRevision(tx: AdminRbacDb) {
    await tx
      .update(this.revisionTable)
      .set({
        revision: sql<number>`${this.revisionTable.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(this.revisionTable.code, ADMIN_RBAC_REVISION_CODE))
      .returning({ revision: this.revisionTable.revision })
  }

  // 规范化账号角色集合，空集合回落为普通管理员角色。
  private async normalizeRoleIds(roleIds: number[] | undefined) {
    const normalized = Array.from(new Set(roleIds ?? []))
    if (normalized.length === 0) {
      const [normalRole] = await this.db
        .select({ id: this.roleTable.id })
        .from(this.roleTable)
        .where(eq(this.roleTable.code, AdminSystemRoleCode.NORMAL_ADMIN))
        .limit(1)
      return normalRole ? [normalRole.id] : []
    }
    await this.assertRoleIdsExist(normalized)
    return normalized
  }

  // 校验角色 id 集合都存在。
  private async assertRoleIdsExist(ids: number[]) {
    if (ids.length === 0) {
      return
    }
    const rows = await this.db
      .select({ id: this.roleTable.id })
      .from(this.roleTable)
      .where(inArray(this.roleTable.id, ids))
    if (rows.length !== ids.length) {
      throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, '角色不存在')
    }
  }

  // 校验权限 id 集合都存在。
  private async assertPermissionIdsExist(ids: number[]) {
    if (ids.length === 0) {
      return
    }
    const rows = await this.db
      .select({ id: this.permissionTable.id })
      .from(this.permissionTable)
      .where(inArray(this.permissionTable.id, ids))
    if (rows.length !== ids.length) {
      throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, '权限不存在')
    }
  }

  // 校验菜单 id 集合都存在。
  private async assertMenuIdsExist(ids: number[]) {
    if (ids.length === 0) {
      return
    }
    const rows = await this.db
      .select({ id: this.menuTable.id })
      .from(this.menuTable)
      .where(inArray(this.menuTable.id, ids))
    if (rows.length !== ids.length) {
      throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, '菜单不存在')
    }
  }

  // 删除菜单前确保没有子菜单。
  private async assertMenuHasNoChildren(id: number) {
    const [{ count: childCount = 0 } = { count: 0 }] = await this.db
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
  private async assertMenuParentIsNotDescendant(id: number, parentId: number) {
    const result = await this.db.execute(sql`
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
  private async getRoleForUpdate(id: number) {
    const [role] = await this.db
      .select()
      .from(this.roleTable)
      .where(eq(this.roleTable.id, id))
      .limit(1)
    if (!role) {
      throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, '角色不存在')
    }
    return role
  }

  // 系统角色禁止删除。
  private assertMutableRole(role: AdminMutableRole) {
    if (role.isSystem || role.code === AdminSystemRoleCode.SUPER_ADMIN) {
      throw new ForbiddenException('系统内置角色不能删除')
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
  private toCurrentMenuDto(menu: AdminMenuRow) {
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
  private buildMenuTree<T extends AdminMenuTreeNode<T>>(
    rows: T[],
  ): T[] {
    const byId = new Map<number, T>()
    const roots: T[] = []
    for (const row of rows) {
      byId.set(row.id, row)
    }
    for (const row of rows) {
      if (row.parentId && byId.has(row.parentId)) {
        byId.get(row.parentId)!.children.push(row)
      } else {
        roots.push(row)
      }
    }
    const sortTree = (items: T[]) => {
      items.sort((a, b) => a.sortOrder - b.sortOrder)
      for (const item of items) {
        sortTree(item.children)
      }
    }
    sortTree(roots)
    return roots
  }

  // 兼容 Drizzle execute 返回结构并提取 rows。
  private extractExecutedRows<T>(
    result: AdminExecutedRowsResult<T> | object | null | undefined,
  ) {
    if (!result || typeof result !== 'object' || !('rows' in result)) {
      return []
    }
    const rows = result.rows
    return Array.isArray(rows) ? rows : []
  }

  // 将空字符串统一收敛为 null。
  private emptyToNull(value: string | null | undefined) {
    const normalized = value?.trim()
    return normalized || null
  }
}
