import type { DbTransaction } from '@db/core'
import type { AdminAppUserProfileUpdateInput } from './admin-app-user-command.type'
import {
  acquireIntegrityLocks,
  DrizzleService,
  exclusiveIntegrityLock,
  tableIntegrityLock,
} from '@db/core'
import { AppUserGrowthProfileService } from '@libs/growth/app-user-growth-profile/app-user-growth-profile.service'
import { BusinessErrorCode, GenderEnum } from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { RevokeTokenReasonEnum } from '@libs/platform/modules/auth/helpers'
import { RsaService } from '@libs/platform/modules/crypto/rsa.service'
import { ScryptService } from '@libs/platform/modules/crypto/scrypt.service'
import { allocateAppUserAccountInTx } from '@libs/user/app-user-account'
import { AppUserCountService } from '@libs/user/app-user-count.service'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { AppUserTokenStorageService } from '@libs/user/token/app-user-token-storage.service'
import { UserService as UserCoreService } from '@libs/user/user.service'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { AdminAppUserServiceSupport } from './admin-app-user.service.support'
import {
  CreateAdminAppUserDto,
  ResetAdminAppUserPasswordDto,
  UpdateAdminAppUserEnabledDto,
  UpdateAdminAppUserProfileDto,
  UpdateAdminAppUserStatusDto,
} from './dto/admin-app-user.dto'

class AdminAppUserDefaultLevelSnapshotDriftError extends Error {}

/**
 * APP 用户账号命令服务。
 *
 * 负责资料、状态、密码、删除恢复与计数修复等命令型操作，统一维护写入事务、
 * 安全校验和异常语义。
 */
@Injectable()
export class AdminAppUserCommandService extends AdminAppUserServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userCoreService: UserCoreService,
    private readonly appUserCountService: AppUserCountService,
    private readonly rsaService: RsaService,
    private readonly scryptService: ScryptService,
    private readonly appUserTokenStorageService: AppUserTokenStorageService,
    private readonly appUserGrowthProfileService: AppUserGrowthProfileService,
  ) {
    super(drizzle, userCoreService)
  }

  // 新建 APP 用户，先解密前端 RSA 密码再 scrypt 哈希。
  async createAppUser(adminUserId: number, dto: CreateAdminAppUserDto) {
    const plainPassword = this.rsaService.decryptWith(dto.password)
    const hashedPassword =
      await this.scryptService.encryptPassword(plainPassword)

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const plan =
        await this.appUserGrowthProfileService.discoverNewUserDefaultLevelLockPlan()
      try {
        await this.drizzle.withErrorHandling(async () =>
          this.db.transaction(async (tx) => {
            await acquireIntegrityLocks(tx, plan.lockRequests)
            const resolution =
              await this.appUserGrowthProfileService.resolveNewUserDefaultLevelAfterLockInTx(
                tx,
                plan,
              )
            if (resolution.outcome === 'snapshot-drift') {
              throw new AdminAppUserDefaultLevelSnapshotDriftError()
            }
            const account = await allocateAppUserAccountInTx(tx)

            const [created] = await tx
              .insert(this.appUserTable)
              .values({
                account,
                nickname: dto.nickname,
                password: hashedPassword,
                phoneNumber: dto.phoneNumber,
                emailAddress: dto.emailAddress,
                avatarUrl: dto.avatarUrl,
                profileBackgroundImageUrl: dto.profileBackgroundImageUrl,
                signature: dto.signature,
                bio: dto.bio,
                genderType: dto.genderType ?? GenderEnum.UNKNOWN,
                birthDate: this.normalizeBirthDate(dto.birthDate),
                isEnabled: dto.isEnabled ?? true,
                status: dto.status ?? UserStatusEnum.NORMAL,
                levelId: resolution.defaultLevelId,
              })
              .returning({ id: this.appUserTable.id })

            await this.appUserCountService.initUserCounts(tx, created.id)
          }),
        )
        return true
      } catch (error) {
        if (error instanceof AdminAppUserDefaultLevelSnapshotDriftError) {
          if (attempt === 0) {
            continue
          }
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '默认等级状态已变化，请重试',
            { cause: error },
          )
        }
        if (this.drizzle.isUniqueViolation(error)) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
            '手机号或邮箱已存在',
            { cause: error },
          )
        }
        throw error
      }
    }

    throw new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      '默认等级状态已变化，请重试',
    )
  }

  // 更新 APP 用户基础资料。
  async updateAppUserProfile(
    adminUserId: number,
    dto: UpdateAdminAppUserProfileDto,
  ) {
    await this.userCoreService.assertActiveUserExists(dto.id)

    const userData: AdminAppUserProfileUpdateInput = {}
    if (dto.nickname !== undefined) {
      userData.nickname = dto.nickname
    }
    if (dto.avatarUrl !== undefined) {
      userData.avatarUrl = dto.avatarUrl
    }
    if (dto.profileBackgroundImageUrl !== undefined) {
      userData.profileBackgroundImageUrl = dto.profileBackgroundImageUrl
    }
    if (dto.phoneNumber !== undefined) {
      userData.phoneNumber = dto.phoneNumber
    }
    if (dto.emailAddress !== undefined) {
      userData.emailAddress = dto.emailAddress
    }
    if (dto.genderType !== undefined) {
      userData.genderType = dto.genderType
    }
    if (dto.birthDate !== undefined) {
      userData.birthDate = this.normalizeBirthDate(dto.birthDate)
    }
    if (dto.signature !== undefined) {
      userData.signature = dto.signature
    }
    if (dto.bio !== undefined) {
      userData.bio = dto.bio
    }

    try {
      if (Object.keys(userData).length > 0) {
        await this.drizzle.withErrorHandling(
          () =>
            this.db
              .update(this.appUserTable)
              .set(userData)
              .where(eq(this.appUserTable.id, dto.id)),
          { notFound: '用户不存在' },
        )
      }
    } catch (error) {
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '手机号或邮箱已存在',
          { cause: error },
        )
      }
      throw error
    }

    return true
  }

  // 更新 APP 用户账号启用状态。
  async updateAppUserEnabled(
    adminUserId: number,
    dto: UpdateAdminAppUserEnabledDto,
  ) {
    await this.userCoreService.assertActiveUserExists(dto.id)

    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.lockAndRecheckAppUserReferenceState(
          tx,
          dto.id,
          false,
          '应用用户不存在',
        )
        const updatedRows = await tx
          .update(this.appUserTable)
          .set({
            isEnabled: dto.isEnabled,
          })
          .where(
            and(
              eq(this.appUserTable.id, dto.id),
              isNull(this.appUserTable.deletedAt),
            ),
          )
        this.drizzle.assertAffectedRows(updatedRows, '用户不存在')
      },
    })
    if (!dto.isEnabled) {
      await this.appUserTokenStorageService.revokeAllByUserId(
        dto.id,
        RevokeTokenReasonEnum.ADMIN_REVOKE,
      )
    }
    return true
  }

  // 更新 APP 用户状态，写入前校验禁言/封禁原因与截止时间。
  async updateAppUserStatus(
    adminUserId: number,
    dto: UpdateAdminAppUserStatusDto,
  ) {
    await this.userCoreService.assertActiveUserExists(dto.id)

    const isNormal = dto.status === UserStatusEnum.NORMAL
    const isTimed =
      dto.status === UserStatusEnum.MUTED ||
      dto.status === UserStatusEnum.BANNED
    const isPermanent =
      dto.status === UserStatusEnum.PERMANENT_MUTED ||
      dto.status === UserStatusEnum.PERMANENT_BANNED
    if (!isNormal && !dto.banReason?.trim()) {
      throw new BadRequestException('禁言或封禁必须填写原因')
    }
    if (isTimed && !dto.banUntil) {
      throw new BadRequestException('临时禁言或封禁必须填写截止时间')
    }
    if (isTimed && dto.banUntil && dto.banUntil <= new Date()) {
      throw new BadRequestException('截止时间必须晚于当前时间')
    }

    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.lockAndRecheckAppUserReferenceState(
          tx,
          dto.id,
          false,
          '应用用户不存在',
        )
        const updatedRows = await tx
          .update(this.appUserTable)
          .set({
            status: dto.status,
            banReason: isNormal ? null : dto.banReason?.trim(),
            banUntil: isNormal || isPermanent ? null : dto.banUntil,
          })
          .where(
            and(
              eq(this.appUserTable.id, dto.id),
              isNull(this.appUserTable.deletedAt),
            ),
          )
        this.drizzle.assertAffectedRows(updatedRows, '用户不存在')
      },
    })
    if (
      dto.status === UserStatusEnum.BANNED ||
      dto.status === UserStatusEnum.PERMANENT_BANNED
    ) {
      await this.appUserTokenStorageService.revokeAllByUserId(
        dto.id,
        RevokeTokenReasonEnum.ADMIN_REVOKE,
      )
    }
    return true
  }

  // 软删除 APP 用户。
  async deleteAppUser(adminUserId: number, userId: number) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.lockAndRecheckAppUserReferenceState(
          tx,
          userId,
          false,
          '用户不存在',
        )
        const updatedRows = await tx
          .update(this.appUserTable)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(this.appUserTable.id, userId),
              isNull(this.appUserTable.deletedAt),
            ),
          )
        this.drizzle.assertAffectedRows(updatedRows, '用户不存在')
      },
    })
    await this.appUserTokenStorageService.revokeAllByUserId(
      userId,
      RevokeTokenReasonEnum.ADMIN_REVOKE,
    )
    return true
  }

  // 恢复已软删除的 APP 用户。
  async restoreAppUser(adminUserId: number, userId: number) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.lockAndRecheckAppUserReferenceState(
          tx,
          userId,
          true,
          '用户不存在或未删除',
        )
        const updatedRows = await tx
          .update(this.appUserTable)
          .set({ deletedAt: null })
          .where(
            and(
              eq(this.appUserTable.id, userId),
              isNotNull(this.appUserTable.deletedAt),
            ),
          )
        this.drizzle.assertAffectedRows(updatedRows, '用户不存在或未删除')
      },
    })
    return true
  }

  // 重置 APP 用户密码，成功后立即撤销全部登录态。
  async resetAppUserPassword(
    adminUserId: number,
    dto: ResetAdminAppUserPasswordDto,
  ) {
    await this.userCoreService.assertActiveUserExists(dto.id)
    const plainPassword = this.rsaService.decryptWith(dto.password)
    const encryptedPassword =
      await this.scryptService.encryptPassword(plainPassword)
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.appUserTable)
          .set({ password: encryptedPassword })
          .where(
            and(
              eq(this.appUserTable.id, dto.id),
              isNull(this.appUserTable.deletedAt),
            ),
          ),
      { notFound: '用户不存在' },
    )
    await this.appUserTokenStorageService.revokeAllByUserId(
      dto.id,
      RevokeTokenReasonEnum.PASSWORD_CHANGE,
    )
    return true
  }

  // app_user 是优惠券任务与关注目标的物理父表，状态变更需先取得精确 record lock。
  // 加锁后在同一事务内复查软删除状态，避免和子写入路径并发错位。
  private async lockAndRecheckAppUserReferenceState(
    tx: DbTransaction,
    userId: number,
    requireDeleted: boolean,
    notFoundMessage: string,
  ) {
    await acquireIntegrityLocks(tx, [
      exclusiveIntegrityLock(tableIntegrityLock('app_user', userId)),
    ])
    const [user] = await tx
      .select({ id: this.appUserTable.id })
      .from(this.appUserTable)
      .where(
        and(
          eq(this.appUserTable.id, userId),
          requireDeleted
            ? isNotNull(this.appUserTable.deletedAt)
            : isNull(this.appUserTable.deletedAt),
        ),
      )
      .limit(1)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        notFoundMessage,
      )
    }
  }

  // 重建单个 APP 用户关注相关计数。
  async rebuildAppUserFollowCounts(adminUserId: number, userId: number) {
    await this.userCoreService.assertActiveUserExists(userId)
    return this.appUserCountService.rebuildFollowCounts(undefined, userId)
  }

  // 全量重建 APP 用户关注相关计数，按批次执行避免尖峰压力。
  async rebuildAllAppUserFollowCounts(adminUserId: number, batchSize = 200) {
    const userIds = await this.db
      .select({ id: this.appUserTable.id })
      .from(this.appUserTable)
      .where(isNull(this.appUserTable.deletedAt))
      .orderBy(this.appUserTable.id)
      .then((rows) => rows.map((row) => row.id))

    await this.processIdsInBatches(userIds, batchSize, async (ids) => {
      await Promise.all(
        ids.map(async (userId) =>
          this.appUserCountService.rebuildFollowCounts(undefined, userId),
        ),
      )
    })

    return true
  }
}
