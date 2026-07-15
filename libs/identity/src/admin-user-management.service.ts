import type {
  AdminUserIdentityTransaction,
  AdminUserResponseSource,
  AdminUserSafeUpdateTarget,
} from '@libs/identity/admin-user.type'
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
import { randomInt } from 'node:crypto'
import { AdminSystemRoleCode } from '@libs/identity/admin-rbac.constant'
import { AdminRbacService } from '@libs/identity/admin-rbac.service'
import { AdminUserIdentityService } from '@libs/identity/admin-user.service'
import { AdminUserTokenStorageService } from '@libs/identity/token/admin-user-token-storage.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { RevokeTokenReasonEnum } from '@libs/platform/modules/auth/helpers'
import { LoginGuardService } from '@libs/platform/modules/auth/login-guard.service'
import { ScryptService } from '@libs/platform/modules/crypto/scrypt.service'
import { Injectable } from '@nestjs/common'
import { AdminAuthRedisKeys } from './admin-auth.constant'

/**
 * 管理员用户服务。
 * 负责密码校验、RBAC 授权和令牌撤销编排；账号持久化统一委托身份域。
 */
@Injectable()
export class AdminUserManagementService {
  constructor(
    private readonly adminUserIdentityService: AdminUserIdentityService,
    private readonly scryptService: ScryptService,
    private readonly loginGuardService: LoginGuardService,
    private readonly tokenStorageService: AdminUserTokenStorageService,
    private readonly rbacService: AdminRbacService,
  ) {}

  // 更新当前管理员账号的自助资料。
  async updateSelfProfile(
    userId: number,
    updateData: AdminSelfProfileUpdateDto,
  ) {
    return this.adminUserIdentityService.updateSelfProfile(userId, updateData)
  }

  // 更新指定管理员账号资料与角色绑定。
  async updateAdminAccount(
    operatorId: number,
    updateData: AdminAccountUpdateDto,
  ) {
    const target = await this.adminUserIdentityService.getAdminAccountForUpdate(
      updateData.id,
    )
    await this.adminUserIdentityService.assertAccountUpdateFieldsAvailable(
      target,
      updateData,
    )

    const normalizedRoleIds = this.normalizeRequiredRoleIds(updateData.roleIds)
    const nextRoles = await this.getRequiredRoleSummaries(normalizedRoleIds)
    const { id: _id, roleIds: _roleIds, ...data } = updateData

    const shouldRevokeTokens =
      await this.adminUserIdentityService.withAdminAccountTransaction(
        async (tx) => {
          await this.rbacService.acquireSuperAdminMutationLocksInTransaction(tx)
          const lockedTarget =
            await this.ensureSafeAdminAccountUpdateInTransaction(
              tx,
              operatorId,
              target,
              updateData,
              nextRoles,
            )
          await this.adminUserIdentityService.updateAdminAccountInTransaction(
            tx,
            updateData.id,
            data,
          )
          await this.rbacService.bindUserRolesLockedInTransaction(
            tx,
            updateData.id,
            normalizedRoleIds,
          )
          return updateData.isEnabled === false && lockedTarget.isEnabled
        },
      )

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
    const { username, password, avatar, mobile, confirmPassword, roleIds } =
      data
    if (password !== confirmPassword) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '两次输入的密码不一致',
      )
    }

    const normalizedRoleIds = this.normalizeRequiredRoleIds(roleIds)
    const nextRoles = await this.getRequiredRoleSummaries(normalizedRoleIds)
    await this.adminUserIdentityService.assertAccountRegistrationFieldsAvailable(
      username,
      mobile,
    )
    const encryptedPassword = await this.scryptService.encryptPassword(password)

    const created =
      await this.adminUserIdentityService.withAdminAccountTransaction(
        async (tx) => {
          await this.rbacService.acquireSuperAdminMutationLocksInTransaction(tx)
          await this.assertOperatorCanGrantSuperAdminRoleInTransaction(
            tx,
            operatorId,
            [],
            nextRoles,
          )
          const createdUser =
            await this.adminUserIdentityService.createAdminAccountInTransaction(
              tx,
              {
                username,
                password: encryptedPassword,
                avatar,
                mobile,
              },
            )
          await this.rbacService.bindUserRolesLockedInTransaction(
            tx,
            createdUser.id,
            normalizedRoleIds,
          )
          return createdUser
        },
      )
    await this.rbacService.invalidateUserAccess(created.id)
    return true
  }

  // 查询当前管理员账号信息。
  async getCurrentUserInfo(userId: number) {
    const user =
      await this.adminUserIdentityService.getAdminUserResponseSource(userId)
    return this.toCurrentUserResponse(user)
  }

  // 查询指定管理员账号详情。
  async getUserDetail(userId: number) {
    const user =
      await this.adminUserIdentityService.getAdminUserResponseSource(userId)
    return this.toUserDetail(user)
  }

  // 分页查询管理员账号列表。
  async getUsers(queryDto: UserPageDto) {
    const page = await this.adminUserIdentityService.getAdminUserPage(queryDto)
    return {
      ...page,
      list: page.list.map(({ user, roles }) =>
        this.toUserListItem(user, roles),
      ),
    }
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

    const user =
      await this.adminUserIdentityService.findPasswordCredentialByUserId(userId)
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

    await this.adminUserIdentityService.updatePassword(
      userId,
      await this.scryptService.encryptPassword(newPassword),
    )
    await this.tokenStorageService.revokeAllByUserId(
      userId,
      RevokeTokenReasonEnum.PASSWORD_CHANGE,
    )
    return true
  }

  // 解锁管理员登录限制。
  async unlockUser(_operatorId: number, userId: number) {
    await this.adminUserIdentityService.assertAdminUserExists(userId)
    await this.loginGuardService.unlock(
      AdminAuthRedisKeys.LOGIN_LOCK(userId),
      AdminAuthRedisKeys.LOGIN_FAIL_COUNT(userId),
    )
    return true
  }

  // 重置管理员账号密码并撤销旧 token。
  async resetPassword(_operatorId: number, id: number) {
    const temporaryPassword = this.generateTemporaryPassword()
    await this.adminUserIdentityService.updatePassword(
      id,
      await this.scryptService.encryptPassword(temporaryPassword),
    )
    await this.tokenStorageService.revokeAllByUserId(
      id,
      RevokeTokenReasonEnum.PASSWORD_CHANGE,
    )
    return { temporaryPassword }
  }

  private toUserListItem(
    user: AdminUserResponseSource,
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

  private async toUserDetail(
    user: AdminUserResponseSource,
  ): Promise<AdminUserDetailDto> {
    const roles = await this.rbacService.getUserRoleSummaries(user.id)
    return this.toUserListItem(user, roles)
  }

  private async toCurrentUserResponse(
    user: AdminUserResponseSource,
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

  // 防止禁用或移除最后一个可用超级管理员。
  private async ensureSafeAdminAccountUpdateInTransaction(
    tx: AdminUserIdentityTransaction,
    operatorId: number,
    target: AdminUserSafeUpdateTarget,
    updateData: AdminAccountUpdateDto,
    nextRoles: AdminRoleSummaryDto[],
  ) {
    const lockedTarget =
      await this.adminUserIdentityService.getLockedAdminAccountForUpdate(
        tx,
        target.id,
      )
    const currentRoles =
      await this.rbacService.getUserRoleSummariesInTransaction(
        tx,
        lockedTarget.id,
      )
    await this.assertOperatorCanGrantSuperAdminRoleInTransaction(
      tx,
      operatorId,
      currentRoles,
      nextRoles,
    )

    if (!this.hasSuperAdminRole(currentRoles)) {
      return lockedTarget
    }
    const removesSuperRole = !this.hasSuperAdminRole(nextRoles)
    const disablesTarget =
      updateData.isEnabled === false && lockedTarget.isEnabled
    if (
      lockedTarget.id === operatorId &&
      (disablesTarget || removesSuperRole)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '不能禁用或移除当前登录超级管理员的超级管理员角色',
      )
    }
    if (disablesTarget || removesSuperRole) {
      await this.rbacService.assertCanRemoveSuperAdminLockedInTransaction(
        tx,
        lockedTarget.id,
      )
    }
    return lockedTarget
  }

  // 在事务内校验只有超级管理员可以授予超级管理员角色。
  private async assertOperatorCanGrantSuperAdminRoleInTransaction(
    tx: AdminUserIdentityTransaction,
    operatorId: number,
    currentRoles: AdminRoleSummaryDto[],
    nextRoles: AdminRoleSummaryDto[],
  ) {
    const grantsSuperAdmin =
      !this.hasSuperAdminRole(currentRoles) && this.hasSuperAdminRole(nextRoles)
    if (!grantsSuperAdmin) {
      return
    }
    const operatorRoles =
      await this.rbacService.getUserRoleSummariesInTransaction(tx, operatorId)
    if (!this.hasSuperAdminRole(operatorRoles)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '只有超级管理员可以授予超级管理员角色',
      )
    }
  }

  private hasSuperAdminRole(roles: AdminRoleSummaryDto[]) {
    return roles.some((role) => role.code === AdminSystemRoleCode.SUPER_ADMIN)
  }

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

  private async getRequiredRoleSummaries(ids: number[]) {
    return this.adminUserIdentityService.getRequiredRoleSummaries(ids)
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
