import type { Db } from '@db/core'
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
import type { AdminPermissionDefinition } from './admin-rbac-metadata.service'
import type { AdminRbacSubjectSnapshot } from './admin-rbac.type'
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

  private get db() {
    return this.drizzle.db
  }

  private get roleTable() {
    return this.drizzle.schema.adminRole
  }

  private get permissionTable() {
    return this.drizzle.schema.adminPermission
  }

  private get menuTable() {
    return this.drizzle.schema.adminMenu
  }

  private get rolePermissionTable() {
    return this.drizzle.schema.adminRolePermission
  }

  private get roleMenuTable() {
    return this.drizzle.schema.adminRoleMenu
  }

  private get userRoleTable() {
    return this.drizzle.schema.adminUserRole
  }

  private get adminUserTable() {
    return this.drizzle.schema.adminUser
  }

  private get revisionTable() {
    return this.drizzle.schema.adminRbacRevision
  }

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

  async listRoles() {
    const rows = await this.db
      .select()
      .from(this.roleTable)
      .orderBy(asc(this.roleTable.sortOrder), asc(this.roleTable.id))
    return rows.map((item) => this.toRoleDto(item))
  }

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

  async listPermissions(): Promise<AdminPermissionDto[]> {
    const rows = await this.db
      .select()
      .from(this.permissionTable)
      .orderBy(asc(this.permissionTable.groupCode), asc(this.permissionTable.code))
    return rows.map((item) => ({
      ...item,
      description: item.description ?? undefined,
      source: item.source as AdminPermissionSource,
    }))
  }

  async menuTree(): Promise<AdminMenuDto[]> {
    const rows = await this.db
      .select()
      .from(this.menuTable)
      .orderBy(asc(this.menuTable.parentId), asc(this.menuTable.sortOrder), asc(this.menuTable.id))
    return this.buildMenuTree(rows.map((item) => this.toMenuDto(item)))
  }

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

  async isSuperAdmin(adminUserId: number) {
    const snapshot = await this.getSubjectSnapshot(adminUserId)
    return snapshot.isSuperAdmin
  }

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

  private async loadAllPermissionCodes() {
    const rows = await this.db
      .select({ code: this.permissionTable.code })
      .from(this.permissionTable)
      .where(eq(this.permissionTable.isEnabled, true))
    return rows.map((item) => item.code)
  }

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

  private async loadAllMenus() {
    return this.db
      .select()
      .from(this.menuTable)
      .where(and(eq(this.menuTable.isEnabled, true), eq(this.menuTable.isVisible, true)))
      .orderBy(asc(this.menuTable.parentId), asc(this.menuTable.sortOrder), asc(this.menuTable.id))
  }

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

  private async ensureRevision(tx: Db) {
    await tx
      .insert(this.revisionTable)
      .values({ code: ADMIN_RBAC_REVISION_CODE, revision: 1 })
      .onConflictDoNothing()
  }

  private async retireMissingCodePermissions(tx: Db, activeCodes: string[]) {
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

  private async ensureBuiltInRoles(tx: Db) {
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

  private async ensureDefaultMenus(tx: Db) {
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

  private async seedMissingDefaultMenus(tx: Db) {
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

  private async normalizeDefaultMenuParents(
    tx: Db,
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

  private async markDefaultMenusSeeded(tx: Db) {
    await tx
      .update(this.revisionTable)
      .set({ menuSeededAt: new Date(), updatedAt: new Date() })
      .where(eq(this.revisionTable.code, ADMIN_RBAC_REVISION_CODE))
  }

  private async grantBuiltInRoleDefaults(tx: Db) {
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

  private async bumpRevision(tx: Db) {
    await tx
      .update(this.revisionTable)
      .set({
        revision: sql<number>`${this.revisionTable.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(this.revisionTable.code, ADMIN_RBAC_REVISION_CODE))
      .returning({ revision: this.revisionTable.revision })
  }

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

  private assertMutableRole(role: { isSystem: boolean, code: string }) {
    if (role.isSystem || role.code === AdminSystemRoleCode.SUPER_ADMIN) {
      throw new ForbiddenException('系统内置角色不能删除')
    }
  }

  private toRoleDto(role: AdminRoleRow): AdminRoleDto {
    return {
      ...role,
      description: role.description ?? undefined,
    }
  }

  private toMenuDto(menu: AdminMenuRow): AdminMenuDto {
    return {
      id: menu.id,
      code: menu.code,
      parentId: menu.parentId,
      type: menu.type as AdminMenuDto['type'],
      title: menu.title,
      path: menu.path,
      name: menu.name ?? undefined,
      component: menu.component ?? undefined,
      redirect: menu.redirect ?? undefined,
      icon: menu.icon ?? undefined,
      sortOrder: menu.sortOrder,
      isVisible: menu.isVisible,
      isEnabled: menu.isEnabled,
      keepAlive: menu.keepAlive,
      externalLink: menu.externalLink ?? undefined,
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
      children: [],
    }
  }

  private toCurrentMenuDto(menu: AdminMenuRow) {
    return {
      id: menu.id,
      code: menu.code,
      title: menu.title,
      path: menu.path,
      name: menu.name ?? undefined,
      component: menu.component ?? undefined,
      redirect: menu.redirect ?? undefined,
      icon: menu.icon ?? undefined,
      sortOrder: menu.sortOrder,
      isVisible: menu.isVisible,
      keepAlive: menu.keepAlive,
      parentId: menu.parentId,
      children: [],
    }
  }

  private buildMenuTree<T extends { id?: number, parentId?: number | null, sortOrder: number, children: T[] }>(
    rows: T[],
  ): T[] {
    const byId = new Map<number, T>()
    const roots: T[] = []
    for (const row of rows) {
      if (typeof row.id === 'number') {
        byId.set(row.id, row)
      }
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

  private extractExecutedRows<T>(
    result: { rows?: T[] | null } | object | null | undefined,
  ) {
    if (!result || typeof result !== 'object' || !('rows' in result)) {
      return []
    }
    const rows = result.rows
    return Array.isArray(rows) ? rows : []
  }

  private emptyToNull(value?: string | null) {
    const normalized = value?.trim()
    return normalized || null
  }
}
