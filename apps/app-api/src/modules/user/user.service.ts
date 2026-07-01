import type { BaseUserAssetsSummaryDto } from '@libs/interaction/user-assets/dto/user-assets.dto'
import type { SQL } from 'drizzle-orm'
/**
 * 应用端用户服务。
 * 提供用户中心相关的业务逻辑，包括资料获取/更新、用户中心汇总、状态判断、资产统计与成长信息。
 */
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'
import { UserExperienceService } from '@libs/growth/experience/experience.service'
import { GrowthAssetTypeEnum } from '@libs/growth/growth-ledger/growth-ledger.constant'
import { UserPointService } from '@libs/growth/point/point.service'
import { TaskService } from '@libs/growth/task/task.service'
import { UserAssetsService } from '@libs/interaction/user-assets/user-assets.service'
import { MessageInboxService } from '@libs/message/inbox/inbox.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { SmsTemplateCodeEnum } from '@libs/platform/modules/sms/sms.constant'
import {
  formatDateOnlyInAppTimeZone,
  startOfTodayInAppTimeZone,
} from '@libs/platform/utils'
import {
  ChangeMyPhoneDto,
  QueryMyBadgeDto,
  QueryMyExperienceRecordDto,
  QueryMyPointRecordDto,
  QueryUserMentionPageDto,
  UpdateMyProfileDto,
  UserCenterDto,
  UserCenterTaskDto,
  UserCountDto,
} from '@libs/user/dto/user-self.dto'
import { UserService as UserCoreService } from '@libs/user/user.service'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, gte, inArray, lt, sql } from 'drizzle-orm'
import { AppAuthErrorMessages } from '../auth/auth.constant'
import { SmsService } from '../auth/sms.service'

@Injectable()
export class UserService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly userCoreService: UserCoreService,
    private readonly smsService: SmsService,
    private readonly userAssetsService: UserAssetsService,
    private readonly userPointService: UserPointService,
    private readonly userExperienceService: UserExperienceService,
    private readonly taskService: TaskService,
    private readonly messageInboxService: MessageInboxService,
  ) {}

  // 复用当前模块共享数据库连接。
  private get db() {
    return this.drizzle.db
  }

  // 复用应用用户表。
  private get appUser() {
    return this.drizzle.schema.appUser
  }

  // 复用用户徽章分配表。
  private get userBadgeAssignment() {
    return this.drizzle.schema.userBadgeAssignment
  }

  // 复用用户徽章表。
  private get userBadge() {
    return this.drizzle.schema.userBadge
  }

  // 复用用户等级规则表。
  private get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  // 复用成长台账记录表。
  private get growthLedgerRecord() {
    return this.drizzle.schema.growthLedgerRecord
  }

  // 将共享用户计数读模型收敛为用户中心 DTO 约定结构，显式排除内部字段并为缺失值兜底为 0。
  private mapUserCenterCounts(counts?: Partial<UserCountDto>) {
    return {
      commentCount: counts?.commentCount ?? 0,
      likeCount: counts?.likeCount ?? 0,
      favoriteCount: counts?.favoriteCount ?? 0,
      followingUserCount: counts?.followingUserCount ?? 0,
      followingAuthorCount: counts?.followingAuthorCount ?? 0,
      followingSectionCount: counts?.followingSectionCount ?? 0,
      followingHashtagCount: counts?.followingHashtagCount ?? 0,
      followersCount: counts?.followersCount ?? 0,
      forumTopicCount: counts?.forumTopicCount ?? 0,
      commentReceivedLikeCount: counts?.commentReceivedLikeCount ?? 0,
      forumTopicReceivedLikeCount: counts?.forumTopicReceivedLikeCount ?? 0,
      forumTopicReceivedFavoriteCount:
        counts?.forumTopicReceivedFavoriteCount ?? 0,
    }
  }

  // 收敛用户资产摘要输出，避免资产域内部补充字段外泄到用户中心契约。
  private mapUserCenterAssets(assets?: Partial<BaseUserAssetsSummaryDto>) {
    return {
      currencyBalance: assets?.currencyBalance ?? 0,
      vipExpiresAt: assets?.vipExpiresAt ?? null,
      availableCouponCount: assets?.availableCouponCount ?? 0,
      purchasedWorkCount: assets?.purchasedWorkCount ?? 0,
      purchasedChapterCount: assets?.purchasedChapterCount ?? 0,
      downloadedWorkCount: assets?.downloadedWorkCount ?? 0,
      downloadedChapterCount: assets?.downloadedChapterCount ?? 0,
      favoriteCount: assets?.favoriteCount ?? 0,
      likeCount: assets?.likeCount ?? 0,
      viewCount: assets?.viewCount ?? 0,
      commentCount: assets?.commentCount ?? 0,
    }
  }

  // 收敛用户中心任务摘要，避免执行层内部辅助字段透传到 HTTP 契约。
  private mapUserCenterTaskSummary(taskSummary?: Partial<UserCenterTaskDto>) {
    return {
      claimableCount: taskSummary?.claimableCount ?? 0,
      claimedCount: taskSummary?.claimedCount ?? 0,
      inProgressCount: taskSummary?.inProgressCount ?? 0,
      rewardPendingCount: taskSummary?.rewardPendingCount ?? 0,
    }
  }

  // 获取用户资料，包含成长快照。
  async getUserProfile(userId: number) {
    const user = await this.userCoreService.ensureUserExists(userId)
    const growth = await this.userCoreService.getUserGrowthSnapshot(userId)
    return this.userCoreService.mapBaseUser(user, growth)
  }

  // 更新用户资料，邮箱唯一冲突时抛出业务异常。
  async updateUserProfile(userId: number, dto: UpdateMyProfileDto) {
    await this.userCoreService.ensureUserExists(userId)

    try {
      await this.drizzle.withErrorHandling(
        () =>
          this.db
            .update(this.appUser)
            .set({
              nickname: dto.nickname,
              avatarUrl: dto.avatarUrl,
              profileBackgroundImageUrl: dto.profileBackgroundImageUrl,
              emailAddress: dto.emailAddress,
              genderType: dto.genderType,
              signature: dto.signature,
              bio: dto.bio,
              birthDate: dto.birthDate
                ? formatDateOnlyInAppTimeZone(dto.birthDate)
                : undefined,
            })
            .where(eq(this.appUser.id, userId)),
        { notFound: '用户不存在' },
      )
      return true
    } catch (error) {
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '邮箱已被使用',
          { cause: error },
        )
      }
      throw error
    }
  }

  // 换绑手机号：需先校验旧手机号再校验新手机号，新号占用冲突统一翻译为稳定业务文案。
  async changeMyPhone(userId: number, dto: ChangeMyPhoneDto) {
    const user = await this.userCoreService.ensureUserExists(userId)

    if (!user.phoneNumber) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前账号未绑定手机号',
      )
    }
    if (dto.currentPhone !== user.phoneNumber) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前手机号与已绑定手机号不一致',
      )
    }
    if (dto.newPhone === user.phoneNumber) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '新手机号不能与当前手机号相同',
      )
    }

    await this.smsService.validateVerifyCode({
      phone: dto.currentPhone,
      code: dto.currentCode,
      templateCode: SmsTemplateCodeEnum.VERIFY_BIND_PHONE,
    })
    await this.smsService.validateVerifyCode({
      phone: dto.newPhone,
      code: dto.newCode,
      templateCode: SmsTemplateCodeEnum.BIND_NEW_PHONE,
    })

    try {
      await this.drizzle.withErrorHandling(
        () =>
          this.db
            .update(this.appUser)
            .set({
              phoneNumber: dto.newPhone,
            })
            .where(eq(this.appUser.id, userId)),
        { notFound: '用户不存在' },
      )
      return true
    } catch (error) {
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          AppAuthErrorMessages.PHONE_EXISTS,
          { cause: error },
        )
      }
      throw error
    }
  }

  // 获取用户中心汇总信息：用户、成长、计数、徽章、资产、消息、任务。
  async getUserCenter(userId: number): Promise<UserCenterDto> {
    const [
      user,
      growth,
      counts,
      badgeCount,
      assets,
      messageSummary,
      taskSummary,
    ] = await Promise.all([
      this.userCoreService.ensureUserExists(userId),
      this.userCoreService.getUserGrowthSnapshot(userId),
      this.userCoreService.getUserCounts(userId),
      this.userCoreService.getBadgeCount(userId),
      this.userAssetsService.getUserAssetsSummary(userId),
      this.messageInboxService.getUnreadSummary(userId),
      this.taskService.getUserTaskSummary(userId),
    ])

    const level = user.levelId
      ? await this.userCoreService.getLevelInfo(user.levelId)
      : undefined

    return {
      user: {
        id: user.id,
        account: user.account,
        phoneNumber: user.phoneNumber ?? null,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl ?? null,
        profileBackgroundImageUrl: user.profileBackgroundImageUrl ?? null,
        emailAddress: user.emailAddress ?? null,
        genderType: user.genderType,
        birthDate: user.birthDate ?? null,
      },
      growth: {
        points: growth.points,
        experience: growth.experience,
        levelId: user.levelId ?? null,
        levelName: level?.name ?? null,
        levelIcon: level?.icon ?? null,
        levelColor: level?.color ?? null,
        badgeCount,
      },
      profile: {
        signature: user.signature ?? null,
        bio: user.bio ?? null,
        status: user.status,
        banReason: user.banReason ?? null,
        banUntil: user.banUntil ?? null,
        counts: this.mapUserCenterCounts(counts),
      },
      lastLoginGeo: {
        geoCountry: user.lastLoginGeoCountry ?? null,
        geoProvince: user.lastLoginGeoProvince ?? null,
        geoCity: user.lastLoginGeoCity ?? null,
        geoIsp: user.lastLoginGeoIsp ?? null,
      },
      assets: this.mapUserCenterAssets(assets),
      message: {
        notificationUnread: messageSummary.notificationUnread,
        totalUnreadCount: messageSummary.totalUnreadCount,
      },
      task: this.mapUserCenterTaskSummary(taskSummary),
    }
  }

  // 获取用户状态信息。
  async getUserStatus(userId: number) {
    const user = await this.userCoreService.ensureUserExists(userId)
    return this.userCoreService.buildUserStatus(user)
  }

  // 获取用户积分统计。
  async getUserPointStats(userId: number) {
    return this.userPointService.getUserPointStats(userId)
  }

  // 分页获取用户积分记录，剥离内部字段后返回。
  async getUserPointRecords(userId: number, query: QueryMyPointRecordDto) {
    const page = await this.userPointService.getAppPointRecordPage({
      ...query,
      userId,
    })

    return {
      ...page,
      list: page.list.map((item) => {
        const { bizKey: _bizKey, context: _context, ...rest } = item
        return rest
      }),
    }
  }

  // 获取用户经验统计，含今日已获经验、当前等级与下一等级信息。
  async getUserExperienceStats(userId: number) {
    const user = await this.userCoreService.ensureUserExists(userId)
    const growth = await this.userCoreService.getUserGrowthSnapshot(userId)

    // 获取今日开始时间
    const today = startOfTodayInAppTimeZone()

    const [todayEarnedRows, levelRows, nextLevelRows] = await Promise.all([
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
        ? this.db
            .select({
              id: this.userLevelRule.id,
              name: this.userLevelRule.name,
              icon: this.userLevelRule.icon,
              color: this.userLevelRule.color,
              requiredExperience: this.userLevelRule.requiredExperience,
            })
            .from(this.userLevelRule)
            .where(eq(this.userLevelRule.id, user.levelId))
        : [],
      this.db
        .select({
          id: this.userLevelRule.id,
          name: this.userLevelRule.name,
          icon: this.userLevelRule.icon,
          color: this.userLevelRule.color,
          requiredExperience: this.userLevelRule.requiredExperience,
        })
        .from(this.userLevelRule)
        .where(
          and(
            eq(this.userLevelRule.isEnabled, true),
            gt(this.userLevelRule.requiredExperience, growth.experience),
          ),
        )
        .orderBy(this.userLevelRule.requiredExperience)
        .limit(1),
    ])
    const todayEarned = Number(todayEarnedRows[0]?.sum ?? 0)
    const level = levelRows[0]
    const nextLevel = nextLevelRows[0]

    return {
      currentExperience: growth.experience,
      todayEarned,
      level: level
        ? {
            id: level.id,
            name: level.name,
            icon: level.icon,
            color: level.color,
            requiredExperience: level.requiredExperience,
          }
        : null,
      nextLevel: nextLevel
        ? {
            id: nextLevel.id,
            name: nextLevel.name,
            icon: nextLevel.icon,
            color: nextLevel.color,
            requiredExperience: nextLevel.requiredExperience,
          }
        : null,
      gapToNextLevel: nextLevel
        ? Math.max(nextLevel.requiredExperience - growth.experience, 0)
        : null,
    }
  }

  // 分页获取用户经验记录，剥离内部字段后返回。
  async getUserExperienceRecords(
    userId: number,
    query: QueryMyExperienceRecordDto,
  ) {
    const page = await this.userExperienceService.getAppExperienceRecordPage({
      ...query,
      userId,
    })

    return {
      ...page,
      list: page.list.map((item) => {
        const {
          bizKey: _bizKey,
          context: _context,
          updatedAt: _updatedAt,
          ...rest
        } = item
        return rest
      }),
    }
  }

  // 分页获取用户徽章列表，支持按名称/类型/启用状态过滤。
  async getUserBadges(userId: number, query: QueryMyBadgeDto) {
    await this.userCoreService.ensureUserExists(userId)

    const { name, type, isEnabled } = query
    const pageParams = this.drizzle.buildPageParams(query, {
      table: this.userBadgeAssignment,
      fallbackOrderBy: [{ createdAt: 'desc' }, { badgeId: 'desc' }],
    })
    const badgeConditions: SQL[] = []

    if (name) {
      badgeConditions.push(buildILikeCondition(this.userBadge.name, name)!)
    }
    if (type !== undefined) {
      badgeConditions.push(eq(this.userBadge.type, type))
    }
    if (isEnabled !== undefined) {
      badgeConditions.push(eq(this.userBadge.isEnabled, isEnabled))
    }

    const badgeWhere =
      badgeConditions.length > 0 ? and(...badgeConditions) : undefined
    const badges = await this.db
      .select({ id: this.userBadge.id })
      .from(this.userBadge)
      .where(badgeWhere)
    const badgeIds = badges.map((item) => item.id)
    if (badgeIds.length === 0) {
      return toPageResult([], 0, pageParams.page)
    }

    const assignmentConditions: SQL[] = [
      eq(this.userBadgeAssignment.userId, userId),
      inArray(this.userBadgeAssignment.badgeId, badgeIds),
    ]
    if (pageParams.dateRange?.gte) {
      assignmentConditions.push(
        gte(this.userBadgeAssignment.createdAt, pageParams.dateRange.gte),
      )
    }
    if (pageParams.dateRange?.lt) {
      assignmentConditions.push(
        lt(this.userBadgeAssignment.createdAt, pageParams.dateRange.lt),
      )
    }
    const where = and(...assignmentConditions)
    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(this.userBadgeAssignment)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.userBadgeAssignment, where),
    ])
    const page = toPageResult(rows, total, pageParams.page)
    const pageBadgeIds = page.list.map((item) => item.badgeId)
    const pageBadges = pageBadgeIds.length
      ? await this.db
          .select()
          .from(this.userBadge)
          .where(inArray(this.userBadge.id, pageBadgeIds))
      : []
    const badgeMap = new Map(
      pageBadges.map((item) => [
        item.id,
        {
          ...item,
          description: item.description ?? null,
          icon: item.icon ?? null,
          business: item.business ?? null,
          eventKey: item.eventKey ?? null,
        },
      ]),
    )

    return {
      ...page,
      list: page.list.map((item) => {
        const badge = badgeMap.get(item.badgeId)

        if (!badge) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '徽章不存在',
          )
        }

        return {
          createdAt: item.createdAt,
          badge,
        }
      }),
    }
  }

  // 获取用户资产统计，包括购买、下载、收藏、点赞、浏览、评论等。
  async getUserAssetsSummary(userId: number) {
    await this.userCoreService.ensureUserExists(userId)
    return this.userAssetsService.getUserAssetsSummary(userId)
  }

  // 获取 @ 提及候选用户，代理共享用户域的轻量搜索。
  async getMentionCandidates(query: QueryUserMentionPageDto) {
    return this.userCoreService.queryMentionCandidates(query)
  }
}
