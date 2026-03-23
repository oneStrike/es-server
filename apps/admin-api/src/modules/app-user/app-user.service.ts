import type {
  AddAdminAppUserExperienceInput,
  AddAdminAppUserPointsInput,
  AssignAdminAppUserBadgeInput,
  ConsumeAdminAppUserPointsInput,
  CreateAdminAppUserInput,
  QueryAdminAppUserBadgeInput,
  QueryAdminAppUserExperienceRecordInput,
  QueryAdminAppUserPageInput,
  QueryAdminAppUserPointRecordInput,
  ResetAdminAppUserPasswordInput,
  UpdateAdminAppUserEnabledInput,
  UpdateAdminAppUserProfileInput,
  UpdateAdminAppUserStatusInput,
} from './app-user.type'
import { DrizzleService } from '@db/core'
import {
  GrowthAssetTypeEnum,
  UserBadgeService,
  UserExperienceService,
  UserPointService,
} from '@libs/growth'
import {
  AdminUserRoleEnum,
  GenderEnum,
  UserStatusEnum,
} from '@libs/platform/constant'
import { RsaService, ScryptService } from '@libs/platform/modules'
import {
  AppUserCountService,
  UserService as UserCoreService,
} from '@libs/user'

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { and, eq, gt, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm'

/**
 * APP 用户管理服务
 * 负责管理端 APP 用户的查询、资料维护、状态维护与成长资产管理
 */
@Injectable()
export class AppUserService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly userCoreService: UserCoreService,
    private readonly userPointService: UserPointService,
    private readonly userExperienceService: UserExperienceService,
    private readonly userBadgeService: UserBadgeService,
    private readonly appUserCountService: AppUserCountService,
    private readonly rsaService: RsaService,
    private readonly scryptService: ScryptService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  private get adminUser() {
    return this.drizzle.schema.adminUser
  }

  private get appUserCount() {
    return this.drizzle.schema.appUserCount
  }

  private get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  private get growthLedgerRecord() {
    return this.drizzle.schema.growthLedgerRecord
  }

  private get userBadgeAssignment() {
    return this.drizzle.schema.userBadgeAssignment
  }

  private get userBadge() {
    return this.drizzle.schema.userBadge
  }

  private async processIdsInBatches(
    ids: number[],
    batchSize: number,
    handler: (batchIds: number[]) => Promise<void>,
  ) {
    for (let index = 0; index < ids.length; index += batchSize) {
      const batchIds = ids.slice(index, index + batchSize)
      await handler(batchIds)
    }
  }

  /**
   * 获取 APP 用户分页列表
   */
  async getAppUserPage(query: QueryAdminAppUserPageInput) {
    const {
      id,
      account,
      phoneNumber,
      nickname,
      emailAddress,
      isEnabled,
      status,
      levelId,
      deletedScope,
      lastLoginStartDate,
      lastLoginEndDate,
      pageIndex,
      pageSize,
    } = query

    const lastLoginAt = this.buildDateRange(
      lastLoginStartDate,
      lastLoginEndDate,
    )

    const where = this.drizzle.buildWhere(this.appUser, {
      and: {
        id,
        account: account ? { like: account } : undefined,
        phoneNumber: phoneNumber ? { like: phoneNumber } : undefined,
        nickname: nickname ? { like: nickname } : undefined,
        emailAddress: emailAddress ? { like: emailAddress } : undefined,
        isEnabled,
        status,
        levelId,
        deletedAt:
          deletedScope === 'deleted'
            ? { isNotNull: true }
            : deletedScope === 'all'
              ? undefined
              : { isNull: true },
        lastLoginAt,
      },
    })

    const page = await this.drizzle.ext.findPagination(this.appUser, {
      where,
      pageIndex,
      pageSize,
    })

    const levelIds = [
      ...new Set(page.list.map((item) => item.levelId).filter(Boolean)),
    ]
    const userIds = page.list.map((item) => item.id)
    const [levelRows, countRows] = await Promise.all([
      levelIds.length > 0
        ? this.db
            .select({
              id: this.userLevelRule.id,
              name: this.userLevelRule.name,
            })
            .from(this.userLevelRule)
            .where(inArray(this.userLevelRule.id, levelIds as number[]))
        : [],
      userIds.length > 0
        ? this.db
            .select({
              userId: this.appUserCount.userId,
              commentCount: this.appUserCount.commentCount,
              likeCount: this.appUserCount.likeCount,
              favoriteCount: this.appUserCount.favoriteCount,
              followingCount: this.appUserCount.followingCount,
              followersCount: this.appUserCount.followersCount,
              forumTopicCount: this.appUserCount.forumTopicCount,
              commentReceivedLikeCount:
                this.appUserCount.commentReceivedLikeCount,
              forumTopicReceivedLikeCount:
                this.appUserCount.forumTopicReceivedLikeCount,
              forumTopicReceivedFavoriteCount:
                this.appUserCount.forumTopicReceivedFavoriteCount,
            })
            .from(this.appUserCount)
            .where(inArray(this.appUserCount.userId, userIds))
        : [],
    ])
    const levelMap = new Map(
      levelRows.map((item) => [item.id, item.name] as const),
    )
    const countMap = new Map(
      countRows.map((item) => [item.userId, item] as const),
    )

    return {
      ...page,
      list: page.list.map((item) => ({
        ...this.userCoreService.mapBaseUser(item),
        levelName: item.levelId ? levelMap.get(item.levelId) : undefined,
        counts: {
          commentCount: countMap.get(item.id)?.commentCount ?? 0,
          likeCount: countMap.get(item.id)?.likeCount ?? 0,
          favoriteCount: countMap.get(item.id)?.favoriteCount ?? 0,
          followingCount: countMap.get(item.id)?.followingCount ?? 0,
          followersCount: countMap.get(item.id)?.followersCount ?? 0,
          forumTopicCount: countMap.get(item.id)?.forumTopicCount ?? 0,
          commentReceivedLikeCount:
            countMap.get(item.id)?.commentReceivedLikeCount ?? 0,
          forumTopicReceivedLikeCount:
            countMap.get(item.id)?.forumTopicReceivedLikeCount ?? 0,
          forumTopicReceivedFavoriteCount:
            countMap.get(item.id)?.forumTopicReceivedFavoriteCount ?? 0,
        },
      })),
    }
  }

  /**
   * 获取 APP 用户详情
   */
  async getAppUserDetail(userId: number) {
    const user = await this.userCoreService.ensureUserExists(userId)

    const [level, counts, badgeCount, pointStats, experienceStats] =
      await Promise.all([
        user.levelId
          ? this.userCoreService.getLevelInfo(user.levelId)
          : undefined,
        this.userCoreService.getUserCounts(userId),
        this.userCoreService.getBadgeCount(userId),
        this.userPointService.getUserPointStats(userId),
        this.getAppUserExperienceStats(userId),
      ])

    return {
      ...this.userCoreService.mapBaseUser(user),
      level: level
        ? {
            id: level.id,
            name: level.name,
            requiredExperience: level.requiredExperience,
          }
        : undefined,
      counts,
      badgeCount,
      pointStats,
      experienceStats,
    }
  }

  async createAppUser(adminUserId: number, dto: CreateAdminAppUserInput) {
    await this.ensureSuperAdmin(adminUserId)
    const account = await this.generateUniqueAccount()
    const hashedPassword = await this.scryptService.encryptPassword(
      dto.password,
    )

    try {
      await this.drizzle.withErrorHandling(async () =>
        this.db.transaction(async (tx) => {
          const [defaultLevel] = await tx
            .select({ id: this.userLevelRule.id })
            .from(this.userLevelRule)
            .where(eq(this.userLevelRule.isEnabled, true))
            .orderBy(this.userLevelRule.sortOrder)
            .limit(1)

          const [created] = await tx
            .insert(this.appUser)
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
              points: 0,
              experience: 0,
              levelId: defaultLevel?.id ?? null,
            })
            .returning({ id: this.appUser.id })

          await this.appUserCountService.initUserCounts(tx, created.id)
        }),
      )
    } catch (error) {
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BadRequestException('手机号或邮箱已存在')
      }
      throw error
    }

    return true
  }

  /**
   * 更新 APP 用户基础资料
   */
  async updateAppUserProfile(
    adminUserId: number,
    dto: UpdateAdminAppUserProfileInput,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.id)

    const userData: Record<string, unknown> = {}
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
        const result = await this.drizzle.withErrorHandling(() =>
          this.db
            .update(this.appUser)
            .set(userData)
            .where(eq(this.appUser.id, dto.id)),
        )
        this.drizzle.assertAffectedRows(result, '用户不存在')
      }
    } catch (error) {
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BadRequestException('手机号或邮箱已存在')
      }
      throw error
    }

    return true
  }

  /**
   * 更新 APP 用户账号启用状态
   */
  async updateAppUserEnabled(
    adminUserId: number,
    dto: UpdateAdminAppUserEnabledInput,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.id)

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appUser)
        .set({
          isEnabled: dto.isEnabled,
        })
        .where(eq(this.appUser.id, dto.id)),
    )
    this.drizzle.assertAffectedRows(result, '用户不存在')
    return true
  }

  /**
   * 更新 APP 用户状态
   */
  async updateAppUserStatus(
    adminUserId: number,
    dto: UpdateAdminAppUserStatusInput,
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

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appUser)
        .set({
          status: dto.status,
          banReason: isNormal ? null : dto.banReason?.trim(),
          banUntil: isNormal || isPermanent ? null : dto.banUntil,
        })
        .where(eq(this.appUser.id, dto.id)),
    )
    this.drizzle.assertAffectedRows(result, '用户不存在')
    return true
  }

  async deleteAppUser(adminUserId: number, userId: number) {
    await this.ensureSuperAdmin(adminUserId)
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appUser)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(this.appUser.id, userId), isNull(this.appUser.deletedAt)),
        ),
    )
    this.drizzle.assertAffectedRows(rows, '用户不存在')
    return true
  }

  async restoreAppUser(adminUserId: number, userId: number) {
    await this.ensureSuperAdmin(adminUserId)
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appUser)
        .set({ deletedAt: null })
        .where(
          and(eq(this.appUser.id, userId), isNotNull(this.appUser.deletedAt)),
        ),
    )
    this.drizzle.assertAffectedRows(rows, '用户不存在或未删除')
    return true
  }

  async resetAppUserPassword(
    adminUserId: number,
    dto: ResetAdminAppUserPasswordInput,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.id)
    const plainPassword = this.rsaService.decryptWith(dto.password)
    const encryptedPassword =
      await this.scryptService.encryptPassword(plainPassword)
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appUser)
        .set({ password: encryptedPassword })
        .where(and(eq(this.appUser.id, dto.id), isNull(this.appUser.deletedAt))),
    )
    this.drizzle.assertAffectedRows(rows, '用户不存在')
    return true
  }

  /**
   * 重建 APP 用户关注相关计数。
   * 当前仅回填 followingCount / followersCount。
   */
  async rebuildAppUserFollowCounts(adminUserId: number, userId: number) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(userId)
    return this.appUserCountService.rebuildFollowCounts(undefined, userId)
  }

  /**
   * 全量重建 APP 用户关注相关计数。
   * 当前仅回填 followingCount / followersCount。
   */
  async rebuildAllAppUserFollowCounts(adminUserId: number, batchSize = 200) {
    await this.ensureSuperAdmin(adminUserId)
    const userIds = await this.db
      .select({ id: this.appUser.id })
      .from(this.appUser)
      .where(isNull(this.appUser.deletedAt))
      .orderBy(this.appUser.id)
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

  /**
   * 获取 APP 用户积分统计
   */
  async getAppUserPointStats(userId: number) {
    await this.userCoreService.ensureUserExists(userId)
    return this.userPointService.getUserPointStats(userId)
  }

  /**
   * 获取 APP 用户积分记录分页
   */
  async getAppUserPointRecords(query: QueryAdminAppUserPointRecordInput) {
    await this.userCoreService.ensureUserExists(query.userId)
    return this.userPointService.getPointRecordPage(query)
  }

  /**
   * 手动增加 APP 用户积分
   */
  async addAppUserPoints(
    adminUserId: number,
    dto: AddAdminAppUserPointsInput,
  ) {
    await this.ensureSuperAdmin(adminUserId)

    return this.userPointService.addPoints({
      ...dto,
      bizKey: this.buildAuditBizKey(
        'app-user:points:add',
        adminUserId,
        dto.userId,
      ),
      source: 'admin_app_user_module',
    })
  }

  /**
   * 手动扣减 APP 用户积分
   */
  async consumeAppUserPoints(
    adminUserId: number,
    dto: ConsumeAdminAppUserPointsInput,
  ) {
    await this.ensureSuperAdmin(adminUserId)

    return this.userPointService.consumePoints({
      ...dto,
      bizKey: this.buildAuditBizKey(
        'app-user:points:consume',
        adminUserId,
        dto.userId,
      ),
      source: 'admin_app_user_module',
    })
  }

  /**
   * 获取 APP 用户经验统计
   */
  async getAppUserExperienceStats(userId: number) {
    const user = await this.userCoreService.ensureUserExists(userId)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayEarnedRows, level, nextLevelRows] = await Promise.all([
      this.db
        .select({
          sum: sql<number>`COALESCE(SUM(${this.growthLedgerRecord.delta}), 0)::int`,
        })
        .from(this.growthLedgerRecord)
        .where(
          and(
            eq(this.growthLedgerRecord.userId, userId),
            eq(
              this.growthLedgerRecord.assetType,
              GrowthAssetTypeEnum.EXPERIENCE,
            ),
            gt(this.growthLedgerRecord.delta, 0),
            gte(this.growthLedgerRecord.createdAt, today),
          ),
        ),
      user.levelId
        ? this.userCoreService.getLevelInfo(user.levelId)
        : undefined,
      this.db
        .select({
          id: this.userLevelRule.id,
          name: this.userLevelRule.name,
          requiredExperience: this.userLevelRule.requiredExperience,
        })
        .from(this.userLevelRule)
        .where(
          and(
            eq(this.userLevelRule.isEnabled, true),
            gt(this.userLevelRule.requiredExperience, user.experience),
          ),
        )
        .orderBy(this.userLevelRule.requiredExperience)
        .limit(1),
    ])
    const todayEarned = Number(todayEarnedRows[0]?.sum ?? 0)
    const nextLevel = nextLevelRows[0]

    return {
      currentExperience: user.experience,
      todayEarned,
      level: level
        ? {
            id: level.id,
            name: level.name,
            requiredExperience: level.requiredExperience,
          }
        : undefined,
      nextLevel: nextLevel
        ? {
            id: nextLevel.id,
            name: nextLevel.name,
            requiredExperience: nextLevel.requiredExperience,
          }
        : undefined,
      gapToNextLevel: nextLevel
        ? Math.max(nextLevel.requiredExperience - user.experience, 0)
        : undefined,
    }
  }

  /**
   * 获取 APP 用户经验记录分页
   */
  async getAppUserExperienceRecords(
    query: QueryAdminAppUserExperienceRecordInput,
  ) {
    await this.userCoreService.ensureUserExists(query.userId)
    return this.userExperienceService.getExperienceRecordPage(query)
  }

  /**
   * 手动增加 APP 用户经验
   */
  async addAppUserExperience(
    adminUserId: number,
    dto: AddAdminAppUserExperienceInput,
  ) {
    await this.ensureSuperAdmin(adminUserId)

    return this.userExperienceService.addExperience({
      ...dto,
      bizKey: this.buildAuditBizKey(
        'app-user:experience:add',
        adminUserId,
        dto.userId,
      ),
      source: 'admin_app_user_module',
    })
  }

  /**
   * 获取 APP 用户徽章分页
   */
  async getAppUserBadges(query: QueryAdminAppUserBadgeInput) {
    await this.userCoreService.ensureUserExists(query.userId)

    const { userId, name, type, isEnabled, business, eventKey, ...pageQuery } =
      query

    const badgeWhere = this.drizzle.buildWhere(this.userBadge, {
      and: {
        name: name ? { like: name } : undefined,
        type,
        isEnabled,
        business,
        eventKey,
      },
    })
    const badges = await this.db
      .select({ id: this.userBadge.id })
      .from(this.userBadge)
      .where(badgeWhere)
    const badgeIds = badges.map((item) => item.id)
    if (badgeIds.length === 0) {
      return {
        list: [],
        total: 0,
        pageIndex: pageQuery.pageIndex,
        pageSize: pageQuery.pageSize,
        totalPages: 0,
      }
    }
    const page = await this.drizzle.ext.findPagination(
      this.userBadgeAssignment,
      {
        where: and(
          eq(this.userBadgeAssignment.userId, userId),
          inArray(this.userBadgeAssignment.badgeId, badgeIds),
        ),
        ...pageQuery,
      },
    )
    const pageBadgeIds = page.list.map((item) => item.badgeId)
    const pageBadges = await this.db
      .select()
      .from(this.userBadge)
      .where(inArray(this.userBadge.id, pageBadgeIds))
    const badgeMap = new Map(pageBadges.map((item) => [item.id, item]))

    return {
      ...page,
      list: page.list.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        badge: badgeMap.get(item.badgeId),
      })),
    }
  }

  /**
   * 为 APP 用户分配徽章
   */
  async assignAppUserBadge(
    adminUserId: number,
    dto: AssignAdminAppUserBadgeInput,
  ) {
    await this.ensureSuperAdmin(adminUserId)

    await this.userBadgeService.assignBadge(dto)
    return true
  }

  /**
   * 撤销 APP 用户徽章
   */
  async revokeAppUserBadge(
    adminUserId: number,
    dto: AssignAdminAppUserBadgeInput,
  ) {
    await this.ensureSuperAdmin(adminUserId)

    await this.userBadgeService.revokeBadge(dto)
    return true
  }

  /**
   * 校验当前管理端用户是否为超级管理员
   */
  private async ensureSuperAdmin(adminUserId: number) {
    const [adminUser] = await this.db
      .select({ role: this.adminUser.role })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, adminUserId))
      .limit(1)

    if (!adminUser) {
      throw new NotFoundException('管理端用户不存在')
    }

    if (adminUser.role !== AdminUserRoleEnum.SUPER_ADMIN) {
      throw new UnauthorizedException('权限不足')
    }
  }

  /**
   * 构建日期范围查询条件
   */
  private buildDateRange(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) {
      return undefined
    }

    const dateRange: Record<string, Date> = {}
    if (startDate) {
      const start = new Date(startDate)
      if (!Number.isNaN(start.getTime())) {
        dateRange.gte = start
      }
    }
    if (endDate) {
      const end = new Date(endDate)
      if (!Number.isNaN(end.getTime())) {
        end.setDate(end.getDate() + 1)
        dateRange.lt = end
      }
    }

    return Object.keys(dateRange).length > 0 ? dateRange : undefined
  }

  /**
   * 构建后台操作幂等业务键
   */
  private buildAuditBizKey(
    action: string,
    adminUserId: number,
    appUserId: number,
  ) {
    return `${action}:${adminUserId}:${appUserId}:${Date.now()}`
  }

  private normalizeBirthDate(value?: string | Date | null) {
    if (value === undefined) {
      return undefined
    }
    if (value === null || value === '') {
      return null
    }
    if (typeof value === 'string') {
      return value
    }
    return value.toISOString().slice(0, 10)
  }

  private async generateUniqueAccount() {
    const randomAccount = Math.floor(100000 + Math.random() * 900000)
    const [existingUser] = await this.db
      .select({ id: this.appUser.id })
      .from(this.appUser)
      .where(eq(this.appUser.account, String(randomAccount)))
      .limit(1)

    if (existingUser) {
      return this.generateUniqueAccount()
    }
    return randomAccount
  }
}
