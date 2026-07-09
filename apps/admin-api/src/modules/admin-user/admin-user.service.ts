import type { AdminRoleSummaryDto } from '@libs/identity/dto/admin-rbac.dto'
import type {
  AdminAccountUpdateDto,
  AdminCurrentUserDto,
  AdminSelfProfileUpdateDto,
  AdminUserDetailDto,
  AdminUserListItemDto,
  ChangePasswordDto,
  UserPageDto,
  UserRegisterDto,
} from '@libs/identity/dto/admin-user.dto'
import type { SQL } from 'drizzle-orm'
import type { AdminRbacDb } from '../rbac/admin-rbac.type'
import type {
  AdminUserProfileUpdateData,
  AdminUserResponseRow,
  AdminUserSafeUpdateTarget,
} from './admin-user.type'
import { randomInt } from 'node:crypto'
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'
import { AdminSystemRoleCode } from '@libs/identity/admin-rbac.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { RevokeTokenReasonEnum } from '@libs/platform/modules/auth/helpers'
import { LoginGuardService } from '@libs/platform/modules/auth/login-guard.service'
import { ScryptService } from '@libs/platform/modules/crypto/scrypt.service'
import { Injectable } from '@nestjs/common'
import { and, asc, eq, exists, inArray } from 'drizzle-orm'
import { AdminAuthRedisKeys } from '../auth/auth.constant'
import { AdminTokenStorageService } from '../auth/token-storage.service'
import { AdminRbacService } from '../rbac/admin-rbac.service'

/**
 * 管理员用户服务。
 */
@Injectable()
export class AdminUserService {
  // 管理员账号表。
  get adminUser() {
    return this.drizzle.schema.adminUser
  }

  // 管理端角色表。
  private get adminRole() {
    return this.drizzle.schema.adminRole
  }

  // 管理员与角色关系表。
  private get adminUserRole() {
    return this.drizzle.schema.adminUserRole
  }

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly scryptService: ScryptService,
    private readonly loginGuardService: LoginGuardService,
    private readonly tokenStorageService: AdminTokenStorageService,
    private readonly rbacService: AdminRbacService,
  ) {}

  // 统一读取 Drizzle 数据库实例。
  private get db() {
    return this.drizzle.db
  }

  // 管理员账号响应字段，不读取密码列。
  private get adminUserResponseColumns() {
    return {
      id: this.adminUser.id,
      username: this.adminUser.username,
      mobile: this.adminUser.mobile,
      avatar: this.adminUser.avatar,
      isEnabled: this.adminUser.isEnabled,
      lastLoginAt: this.adminUser.lastLoginAt,
      lastLoginIp: this.adminUser.lastLoginIp,
      createdAt: this.adminUser.createdAt,
      updatedAt: this.adminUser.updatedAt,
    }
  }

  // 更新当前管理员账号的自助资料。
  async updateSelfProfile(
    userId: number,
    updateData: AdminSelfProfileUpdateDto,
  ) {
    const [user] = await this.db
      .select({
        id: this.adminUser.id,
        username: this.adminUser.username,
        mobile: this.adminUser.mobile,
      })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }

    if (updateData.username && updateData.username !== user.username) {
      const [existingUser] = await this.db
        .select({ id: this.adminUser.id })
        .from(this.adminUser)
        .where(eq(this.adminUser.username, updateData.username))
        .limit(1)

      if (existingUser?.id) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '用户名已存在',
        )
      }
    }

    if (updateData.mobile && updateData.mobile !== user.mobile) {
      const [existingUser] = await this.db
        .select({ id: this.adminUser.id })
        .from(this.adminUser)
        .where(eq(this.adminUser.mobile, updateData.mobile))
        .limit(1)

      if (existingUser?.id) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '手机号已存在',
        )
      }
    }

    const data = this.toSelfProfileUpdateData(updateData)
    if (Object.keys(data).length === 0) {
      return true
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.adminUser)
          .set(data)
          .where(eq(this.adminUser.id, userId)),
      { notFound: '用户不存在' },
    )
    return true
  }

  // 更新指定管理员账号资料与角色绑定。
  async updateAdminAccount(
    operatorId: number,
    updateData: AdminAccountUpdateDto,
  ) {
    const [user] = await this.db
      .select({
        id: this.adminUser.id,
        username: this.adminUser.username,
        mobile: this.adminUser.mobile,
        isEnabled: this.adminUser.isEnabled,
      })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, updateData.id))
      .limit(1)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }

    if (updateData.username && updateData.username !== user.username) {
      const [existingUser] = await this.db
        .select({ id: this.adminUser.id })
        .from(this.adminUser)
        .where(eq(this.adminUser.username, updateData.username))
        .limit(1)

      if (existingUser?.id) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '用户名已存在',
        )
      }
    }

    if (updateData.mobile && updateData.mobile !== user.mobile) {
      const [existingUser] = await this.db
        .select({ id: this.adminUser.id })
        .from(this.adminUser)
        .where(eq(this.adminUser.mobile, updateData.mobile))
        .limit(1)

      if (existingUser?.id) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '手机号已存在',
        )
      }
    }

    const { id: _id, roleIds, ...data } = updateData
    const normalizedRoleIds = this.normalizeRequiredRoleIds(roleIds)
    const nextRoles = await this.assertRoleIdsExist(normalizedRoleIds)

    const shouldRevokeTokens = await this.drizzle.withTransaction(async (tx) => {
      const lockedTarget = await this.ensureSafeAdminAccountUpdateInTransaction(
        tx,
        operatorId,
        user,
        updateData,
        nextRoles,
      )
      const updatedRows = await tx
        .update(this.adminUser)
        .set(data)
        .where(eq(this.adminUser.id, updateData.id))
        .returning({ id: this.adminUser.id })
      this.drizzle.assertAffectedRows(updatedRows, '用户不存在')
      await this.rbacService.bindUserRolesInTransaction(
        tx,
        updateData.id,
        normalizedRoleIds,
      )
      return updateData.isEnabled === false && lockedTarget.isEnabled
    })
    await this.rbacService.invalidateUserAccess(updateData.id)
    if (shouldRevokeTokens) {
      await this.tokenStorageService.revokeAllByUserId(
        updateData.id,
        RevokeTokenReasonEnum.ADMIN_REVOKE,
      )
    }
    return true
  }

  // 注册新的管理员账号。
  async register(operatorId: number, data: UserRegisterDto) {
    const { username, password, avatar, mobile, confirmPassword, roleIds } = data

    if (password !== confirmPassword) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '两次输入的密码不一致',
      )
    }
    const normalizedRoleIds = this.normalizeRequiredRoleIds(roleIds)
    const nextRoles = await this.assertRoleIdsExist(normalizedRoleIds)

    const [usernameExists] = await this.db
      .select({ id: this.adminUser.id })
      .from(this.adminUser)
      .where(eq(this.adminUser.username, username))
      .limit(1)
    if (usernameExists) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
        '用户名已存在',
      )
    }

    const [mobileExists] = mobile
      ? await this.db
          .select({ id: this.adminUser.id })
          .from(this.adminUser)
          .where(eq(this.adminUser.mobile, mobile))
          .limit(1)
      : []
    if (mobileExists) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
        '手机号已存在',
      )
    }

    const encryptedPassword = await this.scryptService.encryptPassword(password)
    const created = await this.drizzle.withTransaction(async (tx) => {
      await this.assertOperatorCanGrantSuperAdminRoleInTransaction(
        tx,
        operatorId,
        [],
        nextRoles,
      )
      const [createdUser] = await tx
        .insert(this.adminUser)
        .values({
          username,
          password: encryptedPassword,
          avatar,
          mobile,
          isEnabled: true,
        })
        .returning({ id: this.adminUser.id })
      this.drizzle.assertAffectedRows([createdUser], '用户创建失败')
      await this.rbacService.bindUserRolesInTransaction(
        tx,
        createdUser.id,
        normalizedRoleIds,
      )
      return createdUser
    })
    await this.rbacService.invalidateUserAccess(created.id)
    return true
  }

  // 查询当前管理员账号信息。
  async getCurrentUserInfo(userId: number) {
    const [user] = await this.db
      .select(this.adminUserResponseColumns)
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
    return this.toCurrentUserResponse(user)
  }

  // 查询指定管理员账号详情。
  async getUserDetail(userId: number) {
    const [user] = await this.db
      .select(this.adminUserResponseColumns)
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
    return this.toUserDetail(user)
  }

  // 分页查询管理员账号列表。
  async getUsers(queryDto: UserPageDto) {
    const { username, isEnabled, mobile, roleId, ...pageDto } = queryDto
    const conditions: SQL[] = []

    if (isEnabled !== undefined) {
      conditions.push(eq(this.adminUser.isEnabled, isEnabled))
    }
    if (username) {
      conditions.push(buildILikeCondition(this.adminUser.username, username)!)
    }
    if (mobile) {
      conditions.push(buildILikeCondition(this.adminUser.mobile, mobile)!)
    }
    if (roleId !== undefined) {
      conditions.push(this.buildRoleFilterExists(roleId))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const pageQuery = this.drizzle.buildPage(pageDto)
    const orderQuery = this.drizzle.buildOrderBy(pageDto.orderBy, {
      table: this.adminUser,
    })
    const [list, total] = await Promise.all([
      this.db
        .select(this.adminUserResponseColumns)
        .from(this.adminUser)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.adminUser, where),
    ])
    const rolesByUserId = await this.getRoleSummariesByUserIds(
      list.map((item) => item.id),
    )
    const responseList = list.map((item) =>
      this.toUserListItem(item, rolesByUserId.get(item.id) ?? []),
    )
    return toPageResult(responseList, total, pageQuery)
  }

  // 修改当前管理员账号密码。
  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword, confirmPassword } = changePasswordDto

    if (newPassword !== confirmPassword) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '新密码和确认密码不一致',
      )
    }

    if (oldPassword === newPassword) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '新密码不能与旧密码相同',
      )
    }

    const [user] = await this.db
      .select({ id: this.adminUser.id, password: this.adminUser.password })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }

    const isPasswordValid = await this.scryptService.verifyPassword(
      oldPassword,
      user.password,
    )
    if (!isPasswordValid) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '旧密码错误',
      )
    }

    await this.drizzle.withErrorHandling(
      async () =>
        this.db
          .update(this.adminUser)
          .set({
            password: await this.scryptService.encryptPassword(newPassword),
          })
          .where(eq(this.adminUser.id, userId)),
      { notFound: '用户不存在' },
    )

    await this.tokenStorageService.revokeAllByUserId(
      userId,
      RevokeTokenReasonEnum.PASSWORD_CHANGE,
    )

    return true
  }

  // 解锁管理员登录限制。
  async unlockUser(_operatorId: number, userId: number) {
    const [user] = await this.db
      .select({ id: this.adminUser.id })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }

    await this.loginGuardService.unlock(
      AdminAuthRedisKeys.LOGIN_LOCK(userId),
      AdminAuthRedisKeys.LOGIN_FAIL_COUNT(userId),
    )

    return true
  }

  // 重置管理员账号密码并撤销旧 token。
  async resetPassword(_operatorId: number, id: number) {
    const temporaryPassword = this.generateTemporaryPassword()
    const encryptedPassword =
      await this.scryptService.encryptPassword(temporaryPassword)
    await this.drizzle.withErrorHandling(
      async () =>
        this.db
          .update(this.adminUser)
          .set({
            password: encryptedPassword,
          })
          .where(eq(this.adminUser.id, id)),
      { notFound: '用户不存在' },
    )

    await this.tokenStorageService.revokeAllByUserId(
      id,
      RevokeTokenReasonEnum.PASSWORD_CHANGE,
    )

    return { temporaryPassword }
  }

  // 映射管理员账号列表项 DTO。
  private toUserListItem(
    user: AdminUserResponseRow,
    roles: AdminRoleSummaryDto[],
  ): AdminUserListItemDto {
    return {
      ...user,
      mobile: user.mobile ?? null,
      avatar: user.avatar ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      lastLoginIp: user.lastLoginIp ?? null,
      roleIds: roles.map((role) => role.id),
      roles,
    }
  }

  // 映射管理员账号详情 DTO。
  private async toUserDetail(
    user: AdminUserResponseRow,
  ): Promise<AdminUserDetailDto> {
    const roles = await this.rbacService.getUserRoleSummaries(user.id)
    return this.toUserListItem(user, roles)
  }

  // 映射当前管理员账号 DTO。
  private async toCurrentUserResponse(
    user: AdminUserResponseRow,
  ): Promise<AdminCurrentUserDto> {
    const [userItem, snapshot] = await Promise.all([
      this.toUserDetail(user),
      this.rbacService.getSubjectSnapshot(user.id),
    ])
    return {
      ...userItem,
      accessCodes: snapshot.permissionCodes,
      isSuperAdmin: snapshot.isSuperAdmin,
    }
  }

  // 收敛当前管理员自助资料允许写入的字段。
  private toSelfProfileUpdateData(
    updateData: AdminSelfProfileUpdateDto,
  ): AdminUserProfileUpdateData {
    const data: AdminUserProfileUpdateData = {}
    if (updateData.username !== undefined) {
      data.username = updateData.username
    }
    if (updateData.avatar !== undefined) {
      data.avatar = updateData.avatar
    }
    if (updateData.mobile !== undefined) {
      data.mobile = updateData.mobile
    }
    return data
  }

  // 防止禁用或移除最后一个可用超级管理员。
  private async ensureSafeAdminAccountUpdateInTransaction(
    tx: AdminRbacDb,
    operatorId: number,
    target: AdminUserSafeUpdateTarget,
    updateData: AdminAccountUpdateDto,
    nextRoles: AdminRoleSummaryDto[],
  ) {
    await this.rbacService.lockSuperAdminMutationInTransaction(tx)
    const [lockedTarget] = await tx
      .select({ id: this.adminUser.id, isEnabled: this.adminUser.isEnabled })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, target.id))
      .limit(1)
    if (!lockedTarget) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
    const currentRoles = await this.rbacService.getUserRoleSummariesInTransaction(
      tx,
      lockedTarget.id,
    )
    await this.assertOperatorCanGrantSuperAdminRoleInTransaction(
      tx,
      operatorId,
      currentRoles,
      nextRoles,
    )

    const targetIsSuperAdmin = this.hasSuperAdminRole(currentRoles)
    if (!targetIsSuperAdmin) {
      return lockedTarget
    }

    const removesSuperRole = !this.hasSuperAdminRole(nextRoles)
    const disablesTarget = updateData.isEnabled === false && lockedTarget.isEnabled

    if (lockedTarget.id === operatorId && (disablesTarget || removesSuperRole)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '不能禁用或移除当前登录超级管理员的超级管理员角色',
      )
    }
    if (disablesTarget || removesSuperRole) {
      await this.rbacService.assertCanRemoveSuperAdminFromUserInTransaction(
        tx,
        lockedTarget.id,
      )
    }
    return lockedTarget
  }

  // 在事务内校验只有超级管理员可以授予超级管理员角色。
  private async assertOperatorCanGrantSuperAdminRoleInTransaction(
    tx: AdminRbacDb,
    operatorId: number,
    currentRoles: AdminRoleSummaryDto[],
    nextRoles: AdminRoleSummaryDto[],
  ) {
    const grantsSuperAdmin =
      !this.hasSuperAdminRole(currentRoles) && this.hasSuperAdminRole(nextRoles)
    if (!grantsSuperAdmin) {
      return
    }

    await this.rbacService.lockSuperAdminMutationInTransaction(tx)
    const operatorRoles = await this.rbacService.getUserRoleSummariesInTransaction(
      tx,
      operatorId,
    )
    if (!this.hasSuperAdminRole(operatorRoles)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '只有超级管理员可以授予超级管理员角色',
      )
    }
  }

  // 判断角色摘要列表是否包含超级管理员角色。
  private hasSuperAdminRole(roles: AdminRoleSummaryDto[]) {
    return roles.some((role) => role.code === AdminSystemRoleCode.SUPER_ADMIN)
  }

  // 构建角色过滤条件，避免分页前物化管理员 id 列表。
  private buildRoleFilterExists(roleId: number) {
    return exists(
      this.db
        .select({ adminUserId: this.adminUserRole.adminUserId })
        .from(this.adminUserRole)
        .where(
          and(
            eq(this.adminUserRole.roleId, roleId),
            eq(this.adminUserRole.adminUserId, this.adminUser.id),
          ),
        ),
    )
  }

  // 批量查询管理员账号角色摘要，供列表页一次性装配当前页角色信息。
  private async getRoleSummariesByUserIds(userIds: number[]) {
    const normalized = Array.from(new Set(userIds))
    const rolesByUserId = new Map<number, AdminRoleSummaryDto[]>()
    if (normalized.length === 0) {
      return rolesByUserId
    }

    const rows = await this.db
      .select({
        adminUserId: this.adminUserRole.adminUserId,
        id: this.adminRole.id,
        code: this.adminRole.code,
        name: this.adminRole.name,
        isSystem: this.adminRole.isSystem,
        isEnabled: this.adminRole.isEnabled,
      })
      .from(this.adminUserRole)
      .innerJoin(this.adminRole, eq(this.adminRole.id, this.adminUserRole.roleId))
      .where(inArray(this.adminUserRole.adminUserId, normalized))
      .orderBy(
        asc(this.adminUserRole.adminUserId),
        asc(this.adminRole.sortOrder),
        asc(this.adminRole.id),
      )

    for (const row of rows) {
      const roles = rolesByUserId.get(row.adminUserId) ?? []
      roles.push({
        id: row.id,
        code: row.code,
        name: row.name,
        isSystem: row.isSystem,
        isEnabled: row.isEnabled,
      })
      rolesByUserId.set(row.adminUserId, roles)
    }

    return rolesByUserId
  }

  // 查询指定角色 id 的摘要信息。
  private async getRoleSummariesByIds(ids: number[]) {
    if (ids.length === 0) {
      return []
    }
    return this.db
      .select({
        id: this.adminRole.id,
        code: this.adminRole.code,
        name: this.adminRole.name,
        isSystem: this.adminRole.isSystem,
        isEnabled: this.adminRole.isEnabled,
      })
      .from(this.adminRole)
      .where(inArray(this.adminRole.id, ids))
  }

  // 规范化必填角色 id 集合。
  private normalizeRequiredRoleIds(ids: number[]) {
    const normalized = Array.from(new Set(ids ?? []))
    if (normalized.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '至少选择一个角色',
      )
    }
    return normalized
  }

  // 校验角色 id 集合全部存在，并返回摘要信息。
  private async assertRoleIdsExist(ids: number[]) {
    const roles = await this.getRoleSummariesByIds(ids)
    if (roles.length !== ids.length) {
      throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, '角色不存在')
    }
    return roles
  }

  // 生成一次性临时密码。
  private generateTemporaryPassword() {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const special = '!@#$%^&*'
    const pick = (characters: string) =>
      characters[randomInt(characters.length)]

    let password = ''
    for (let i = 0; i < 2; i += 1) {
      password += pick(uppercase)
      password += pick(lowercase)
      password += pick(numbers)
      password += pick(special)
    }

    const allCharacters = uppercase + lowercase + numbers + special
    for (let i = password.length; i < 16; i += 1) {
      password += pick(allCharacters)
    }

    return password
      .split('')
      .sort(() => randomInt(3) - 1)
      .join('')
  }
}
