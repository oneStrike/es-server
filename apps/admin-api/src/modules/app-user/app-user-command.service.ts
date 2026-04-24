import type { PostgresErrorSourceObject } from '@db/core'
import type { AppUserInsert } from '@db/schema'
import { DrizzleService } from '@db/core'
import { AppUserTokenStorageService } from '@libs/identity/token/app-user-token-storage.service'
import { BusinessErrorCode, GenderEnum } from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { RevokeTokenReasonEnum } from '@libs/platform/modules/auth/helpers'
import { RsaService } from '@libs/platform/modules/crypto/rsa.service'
import { ScryptService } from '@libs/platform/modules/crypto/scrypt.service'
import { AppUserCountService } from '@libs/user/app-user-count.service'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import {
  CreateAdminAppUserDto,
  ResetAdminAppUserPasswordDto,
  UpdateAdminAppUserEnabledDto,
  UpdateAdminAppUserProfileDto,
  UpdateAdminAppUserStatusDto,
} from '@libs/user/dto/admin-app-user.dto'
import { UserService as UserCoreService } from '@libs/user/user.service'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'
import { AppUserServiceSupport } from './app-user.service.support'

type AppUserProfileUpdateInput = Partial<
  Pick<
    AppUserInsert,
    | 'nickname'
    | 'avatarUrl'
    | 'phoneNumber'
    | 'emailAddress'
    | 'genderType'
    | 'birthDate'
    | 'signature'
    | 'bio'
  >
>

/**
 * APP 用户账号命令服务。
 *
 * 负责资料、状态、密码、删除恢复与计数修复等命令型操作，统一维护写入事务、
 * 安全校验和异常语义。
 */
@Injectable()
export class AppUserCommandService extends AppUserServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userCoreService: UserCoreService,
    private readonly appUserCountService: AppUserCountService,
    private readonly rsaService: RsaService,
    private readonly scryptService: ScryptService,
    private readonly appUserTokenStorageService: AppUserTokenStorageService,
  ) {
    super(drizzle, userCoreService)
  }

  /**
   * 新建 APP 用户。
   *
   * 创建链路统一先解密前端 RSA 密码，再做 scrypt 哈希，避免把密文直接写入密码库。
   */
  async createAppUser(adminUserId: number, dto: CreateAdminAppUserDto) {
    await this.ensureSuperAdmin(adminUserId)
    const account = await this.generateUniqueAccount()
    const plainPassword = this.rsaService.decryptWith(dto.password)
    const hashedPassword =
      await this.scryptService.encryptPassword(plainPassword)

    try {
      await this.drizzle.withErrorHandling(async () =>
        this.db.transaction(async (tx) => {
          const [defaultLevel] = await tx
            .select({ id: this.userLevelRuleTable.id })
            .from(this.userLevelRuleTable)
            .where(eq(this.userLevelRuleTable.isEnabled, true))
            .orderBy(
              asc(this.userLevelRuleTable.sortOrder),
              asc(this.userLevelRuleTable.id),
            )
            .limit(1)

          const [created] = await tx
            .insert(this.appUserTable)
            .values({
              account: String(account),
              nickname: dto.nickname,
              password: hashedPassword,
              phoneNumber: dto.phoneNumber,
              emailAddress: dto.emailAddress,
              avatarUrl: dto.avatarUrl,
              signature: dto.signature,
              bio: dto.bio,
              genderType: dto.genderType ?? GenderEnum.UNKNOWN,
              birthDate: this.normalizeBirthDate(dto.birthDate),
              isEnabled: dto.isEnabled ?? true,
              status: dto.status ?? UserStatusEnum.NORMAL,
              levelId: defaultLevel?.id ?? null,
            })
            .returning({ id: this.appUserTable.id })

          await this.appUserCountService.initUserCounts(tx, created.id)
        }),
      )
    } catch (error) {
      const drizzleError =
        error instanceof Error
          ? error
          : typeof error === 'object' && error !== null
            ? (error as PostgresErrorSourceObject)
            : undefined
      if (this.drizzle.isUniqueViolation(drizzleError)) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '手机号或邮箱已存在',
        )
      }
      throw error
    }

    return true
  }

  /** 更新 APP 用户基础资料。 */
  async updateAppUserProfile(
    adminUserId: number,
    dto: UpdateAdminAppUserProfileDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.id)

    const userData: AppUserProfileUpdateInput = {}
    if (dto.nickname !== undefined) {
      userData.nickname = dto.nickname
    }
    if (dto.avatarUrl !== undefined) {
      userData.avatarUrl = dto.avatarUrl
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
      const drizzleError =
        error instanceof Error
          ? error
          : typeof error === 'object' && error !== null
            ? (error as PostgresErrorSourceObject)
            : undefined
      if (this.drizzle.isUniqueViolation(drizzleError)) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '手机号或邮箱已存在',
        )
      }
      throw error
    }

    return true
  }

  /** 更新 APP 用户账号启用状态。 */
  async updateAppUserEnabled(
    adminUserId: number,
    dto: UpdateAdminAppUserEnabledDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.id)

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.appUserTable)
          .set({
            isEnabled: dto.isEnabled,
          })
          .where(eq(this.appUserTable.id, dto.id)),
      { notFound: '用户不存在' },
    )
    return true
  }

  /**
   * 更新 APP 用户状态。
   *
   * 统一在写入前校验禁言/封禁原因与截止时间，避免状态字段与附属字段组合失真。
   */
  async updateAppUserStatus(
    adminUserId: number,
    dto: UpdateAdminAppUserStatusDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.id)

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

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.appUserTable)
          .set({
            status: dto.status,
            banReason: isNormal ? null : dto.banReason?.trim(),
            banUntil: isNormal || isPermanent ? null : dto.banUntil,
          })
          .where(eq(this.appUserTable.id, dto.id)),
      { notFound: '用户不存在' },
    )
    return true
  }

  /** 软删除 APP 用户。 */
  async deleteAppUser(adminUserId: number, userId: number) {
    await this.ensureSuperAdmin(adminUserId)
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.appUserTable)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(this.appUserTable.id, userId),
              isNull(this.appUserTable.deletedAt),
            ),
          ),
      { notFound: '用户不存在' },
    )
    return true
  }

  /** 恢复已软删除的 APP 用户。 */
  async restoreAppUser(adminUserId: number, userId: number) {
    await this.ensureSuperAdmin(adminUserId)
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.appUserTable)
          .set({ deletedAt: null })
          .where(
            and(
              eq(this.appUserTable.id, userId),
              isNotNull(this.appUserTable.deletedAt),
            ),
          ),
      { notFound: '用户不存在或未删除' },
    )
    return true
  }

  /**
   * 重置 APP 用户密码。
   *
   * 密码更新成功后立即撤销 APP 侧全部登录态，保证安全边界与应用端自助改密一致。
   */
  async resetAppUserPassword(
    adminUserId: number,
    dto: ResetAdminAppUserPasswordDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.id)
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

  /**
   * 重建单个 APP 用户关注相关计数。
   *
   * 当前仅回填关注分项与 `followersCount`。
   */
  async rebuildAppUserFollowCounts(adminUserId: number, userId: number) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(userId)
    return this.appUserCountService.rebuildFollowCounts(undefined, userId)
  }

  /**
   * 全量重建 APP 用户关注相关计数。
   *
   * 仅处理未软删除账号，并按批次执行，避免一次性全表修复造成尖峰压力。
   */
  async rebuildAllAppUserFollowCounts(adminUserId: number, batchSize = 200) {
    await this.ensureSuperAdmin(adminUserId)
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
