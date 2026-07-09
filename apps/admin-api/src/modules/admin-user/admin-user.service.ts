import type { AdminRoleSummaryDto } from '@libs/identity/dto/admin-rbac.dto'
import type {
  AdminUserResponseDto,
  ChangePasswordDto,
  UpdateUserDto,
  UserPageDto,
  UserRegisterDto,
} from '@libs/identity/dto/admin-user.dto'
import type { SQL } from 'drizzle-orm'
import type {
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
import { and, eq, inArray } from 'drizzle-orm'
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

  // 更新管理员账号资料与角色绑定。
  async updateUserInfo(operatorId: number, updateData: UpdateUserDto) {
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

    await this.ensureSafeAdminAccountUpdate(operatorId, user, updateData)

    const { id: _id, roleIds, ...data } = updateData
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.adminUser)
          .set(data)
          .where(eq(this.adminUser.id, updateData.id)),
      { notFound: '用户不存在' },
    )
    await this.rbacService.bindUserRoles(updateData.id, roleIds)
    if (updateData.isEnabled === false && user.isEnabled) {
      await this.tokenStorageService.revokeAllByUserId(
        updateData.id,
        RevokeTokenReasonEnum.ADMIN_REVOKE,
      )
    }
    return true
  }

  // 注册新的管理员账号。
  async register(_operatorId: number, data: UserRegisterDto) {
    const { username, password, avatar, mobile, confirmPassword, roleIds } = data

    if (password !== confirmPassword) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '两次输入的密码不一致',
      )
    }
    await this.assertRoleIdsExist(roleIds)

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
    const [created] = await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.adminUser)
        .values({
          username,
          password: encryptedPassword,
          avatar,
          mobile,
          isEnabled: true,
        })
        .returning({ id: this.adminUser.id }),
    )
    await this.rbacService.bindUserRoles(created.id, roleIds)
    return true
  }

  // 查询当前管理员账号信息。
  async getUserInfo(userId: number) {
    const [user] = await this.db
      .select()
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
    return this.toUserResponse(user)
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
      const rows = await this.db
        .select({ adminUserId: this.adminUserRole.adminUserId })
        .from(this.adminUserRole)
        .where(eq(this.adminUserRole.roleId, roleId))
      const userIds = rows.map((item) => item.adminUserId)
      if (userIds.length === 0) {
        const pageQuery = this.drizzle.buildPage(pageDto)
        return toPageResult([], 0, pageQuery)
      }
      conditions.push(inArray(this.adminUser.id, userIds))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const pageQuery = this.drizzle.buildPage(pageDto)
    const orderQuery = this.drizzle.buildOrderBy(pageDto.orderBy, {
      table: this.adminUser,
    })
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.adminUser)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.adminUser, where),
    ])
    const responseList = await Promise.all(
      list.map(async (item) => this.toUserResponse(item)),
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

  // 映射管理员账号输出 DTO。
  private async toUserResponse(
    user: AdminUserResponseRow,
  ): Promise<AdminUserResponseDto> {
    const { password: _password, ...rest } = user
    const [roles, snapshot] = await Promise.all([
      this.rbacService.getUserRoleSummaries(user.id),
      this.rbacService.getSubjectSnapshot(user.id),
    ])
    return {
      ...rest,
      roleIds: roles.map((role) => role.id),
      roles,
      accessCodes: snapshot.permissionCodes,
      isSuperAdmin: snapshot.isSuperAdmin,
    }
  }

  // 防止禁用或移除最后一个可用超级管理员。
  private async ensureSafeAdminAccountUpdate(
    operatorId: number,
    target: AdminUserSafeUpdateTarget,
    updateData: UpdateUserDto,
  ) {
    const currentRoles = await this.rbacService.getUserRoleSummaries(target.id)
    const targetIsSuperAdmin = this.hasSuperAdminRole(currentRoles)
    if (!targetIsSuperAdmin) {
      return
    }

    const nextRoles = await this.getRoleSummariesByIds(updateData.roleIds)
    const removesSuperRole = !this.hasSuperAdminRole(nextRoles)
    const disablesTarget = updateData.isEnabled === false && target.isEnabled

    if (target.id === operatorId && (disablesTarget || removesSuperRole)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '不能禁用或移除当前登录超级管理员的超级管理员角色',
      )
    }
    if (disablesTarget || removesSuperRole) {
      await this.rbacService.assertCanRemoveSuperAdminFromUser(target.id)
    }
  }

  // 判断角色摘要列表是否包含超级管理员角色。
  private hasSuperAdminRole(roles: AdminRoleSummaryDto[]) {
    return roles.some((role) => role.code === AdminSystemRoleCode.SUPER_ADMIN)
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

  // 校验角色 id 集合非空且全部存在。
  private async assertRoleIdsExist(ids: number[]) {
    const normalized = Array.from(new Set(ids ?? []))
    if (normalized.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '至少选择一个角色',
      )
    }
    const rows = await this.getRoleSummariesByIds(normalized)
    if (rows.length !== normalized.length) {
      throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, '角色不存在')
    }
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
