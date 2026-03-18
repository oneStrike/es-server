import type {
  AddAdminAppUserExperienceDto,
  AddAdminAppUserPointsDto,
  AssignAdminAppUserBadgeDto,
  ConsumeAdminAppUserPointsDto,
  QueryAdminAppUserBadgeDto,
  QueryAdminAppUserExperienceRecordDto,
  QueryAdminAppUserPageDto,
  QueryAdminAppUserPointRecordDto,
  UpdateAdminAppUserEnabledDto,
  UpdateAdminAppUserProfileDto,
  UpdateAdminAppUserStatusDto,
} from './dto/app-user.dto'
import { DrizzleService } from '@db/core'
import {
  GrowthAssetTypeEnum,
  UserBadgeService,
  UserExperienceService,
  UserPointService,
} from '@libs/growth'
import { AdminUserRoleEnum, UserStatusEnum } from '@libs/platform/constant'
import { UserService as UserCoreService } from '@libs/user'

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { and, eq, gt, gte, inArray, sql } from 'drizzle-orm'

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

  private get forumProfile() {
    return this.drizzle.schema.forumProfile
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

  /**
   * 获取 APP 用户分页列表
   */
  async getAppUserPage(query: QueryAdminAppUserPageDto) {
    const {
      id,
      account,
      phoneNumber,
      nickname,
      emailAddress,
      isEnabled,
      status,
      levelId,
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
        deletedAt: { isNull: true },
        lastLoginAt,
      },
    })

    const page = await this.drizzle.ext.findPagination(this.appUser, {
      where,
      pageIndex,
      pageSize,
    })

    const levelIds = [...new Set(page.list.map((item) => item.levelId).filter(Boolean))]
    const userIds = page.list.map((item) => item.id)
    const [levelRows, forumRows] = await Promise.all([
      levelIds.length > 0
        ? this.db
            .select({ id: this.userLevelRule.id, name: this.userLevelRule.name })
            .from(this.userLevelRule)
            .where(inArray(this.userLevelRule.id, levelIds as number[]))
        : [],
      userIds.length > 0
        ? this.db
            .select({
              userId: this.forumProfile.userId,
              topicCount: this.forumProfile.topicCount,
              replyCount: this.forumProfile.replyCount,
            })
            .from(this.forumProfile)
            .where(inArray(this.forumProfile.userId, userIds))
        : [],
    ])
    const levelMap = new Map(levelRows.map((item) => [item.id, item.name] as const))
    const forumMap = new Map(
      forumRows.map((item) => [item.userId, item] as const),
    )

    return {
      ...page,
      list: page.list.map((item) => ({
        ...this.userCoreService.mapBaseUser(item),
        levelName: item.levelId ? levelMap.get(item.levelId) : undefined,
        topicCount: forumMap.get(item.id)?.topicCount ?? 0,
        replyCount: forumMap.get(item.id)?.replyCount ?? 0,
      })),
    }
  }

  /**
   * 获取 APP 用户详情
   */
  async getAppUserDetail(userId: number) {
    const user = await this.userCoreService.ensureUserExists(userId)

    const [level, forumProfile, badgeCount, pointStats, experienceStats] = await Promise.all([
      user.levelId ? this.userCoreService.getLevelInfo(user.levelId) : undefined,
      this.userCoreService.getUserForumProfile(userId),
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
      forumProfile,
      badgeCount,
      pointStats,
      experienceStats,
    }
  }

  /**
   * 更新 APP 用户基础资料
   */
  async updateAppUserProfile(
    adminUserId: number,
    dto: UpdateAdminAppUserProfileDto,
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
      userData.birthDate = dto.birthDate
    }

    try {
      await this.drizzle.withErrorHandling(async () =>
        this.db.transaction(async (tx) => {
          if (Object.keys(userData).length > 0) {
            await tx
              .update(this.appUser)
              .set(userData)
              .where(eq(this.appUser.id, dto.id))
          }

          if (dto.signature !== undefined || dto.bio !== undefined) {
            const forumProfileData: Record<string, string> = {}
            if (dto.signature !== undefined) {
              forumProfileData.signature = dto.signature
            }
            if (dto.bio !== undefined) {
              forumProfileData.bio = dto.bio
            }

            const existing = await tx
              .select({ id: this.forumProfile.id })
              .from(this.forumProfile)
              .where(eq(this.forumProfile.userId, dto.id))
              .limit(1)
            if (existing[0]) {
              await tx
                .update(this.forumProfile)
                .set(forumProfileData)
                .where(eq(this.forumProfile.userId, dto.id))
            } else {
              await tx.insert(this.forumProfile).values({
                userId: dto.id,
                signature: dto.signature ?? '',
                bio: dto.bio ?? '',
              })
            }
          }
        }),
      )
    } catch (error) {
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BadRequestException('手机号或邮箱已存在')
      }
      throw error
    }

    return this.getAppUserDetail(dto.id)
  }

  /**
   * 更新 APP 用户账号启用状态
   */
  async updateAppUserEnabled(
    adminUserId: number,
    dto: UpdateAdminAppUserEnabledDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.id)

    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appUser)
        .set({
          isEnabled: dto.isEnabled,
        })
        .where(eq(this.appUser.id, dto.id))
        .returning({ id: this.appUser.id }),
    )
    this.drizzle.assertAffectedRows(rows, '用户不存在')

    return this.getAppUserDetail(dto.id)
  }

  /**
   * 更新 APP 用户社区状态
   */
  async updateAppUserStatus(
    adminUserId: number,
    dto: UpdateAdminAppUserStatusDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.id)

    const isNormal = dto.status === UserStatusEnum.NORMAL
    const isPermanent =
      dto.status === UserStatusEnum.PERMANENT_MUTED
      || dto.status === UserStatusEnum.PERMANENT_BANNED

    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appUser)
        .set({
          status: dto.status,
          banReason: isNormal ? null : (dto.banReason ?? null),
          banUntil: isNormal || isPermanent ? null : (dto.banUntil ?? null),
        })
        .where(eq(this.appUser.id, dto.id))
        .returning({ id: this.appUser.id }),
    )
    this.drizzle.assertAffectedRows(rows, '用户不存在')

    return this.getAppUserDetail(dto.id)
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
  async getAppUserPointRecords(query: QueryAdminAppUserPointRecordDto) {
    await this.userCoreService.ensureUserExists(query.userId)
    return this.userPointService.getPointRecordPage(query)
  }

  /**
   * 手动增加 APP 用户积分
   */
  async addAppUserPoints(adminUserId: number, dto: AddAdminAppUserPointsDto) {
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
    dto: ConsumeAdminAppUserPointsDto,
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
        .select({ sum: sql<number>`COALESCE(SUM(${this.growthLedgerRecord.delta}), 0)::int` })
        .from(this.growthLedgerRecord)
        .where(
          and(
            eq(this.growthLedgerRecord.userId, userId),
            eq(this.growthLedgerRecord.assetType, GrowthAssetTypeEnum.EXPERIENCE),
            gt(this.growthLedgerRecord.delta, 0),
            gte(this.growthLedgerRecord.createdAt, today),
          ),
        ),
      user.levelId ? this.userCoreService.getLevelInfo(user.levelId) : undefined,
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
    query: QueryAdminAppUserExperienceRecordDto,
  ) {
    await this.userCoreService.ensureUserExists(query.userId)
    return this.userExperienceService.getExperienceRecordPage(query)
  }

  /**
   * 手动增加 APP 用户经验
   */
  async addAppUserExperience(
    adminUserId: number,
    dto: AddAdminAppUserExperienceDto,
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
  async getAppUserBadges(query: QueryAdminAppUserBadgeDto) {
    await this.userCoreService.ensureUserExists(query.userId)

    const {
      userId,
      name,
      type,
      isEnabled,
      business,
      eventKey,
      ...pageQuery
    } = query

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
    const page = await this.drizzle.ext.findPagination(this.userBadgeAssignment, {
      where: and(
        eq(this.userBadgeAssignment.userId, userId),
        inArray(this.userBadgeAssignment.badgeId, badgeIds),
      ),
      ...pageQuery,
    })
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
    dto: AssignAdminAppUserBadgeDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)

    await this.userBadgeService.assignBadge(dto)
    return {
      userId: dto.userId,
      badgeId: dto.badgeId,
    }
  }

  /**
   * 撤销 APP 用户徽章
   */
  async revokeAppUserBadge(
    adminUserId: number,
    dto: AssignAdminAppUserBadgeDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)

    await this.userBadgeService.revokeBadge(dto)
    return {
      userId: dto.userId,
      badgeId: dto.badgeId,
    }
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
}
