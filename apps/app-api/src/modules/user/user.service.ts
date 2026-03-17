/**
 * 用户服务
 *
 * 提供用户中心相关的业务逻辑，包括：
 * - 用户基本信息的获取和更新
 * - 用户论坛资料的获取和更新
 * - 用户中心汇总信息
 * - 用户状态判断
 * - 用户资产统计（购买、下载、收藏、点赞等）
 * - 用户成长信息（积分、经验、等级、徽章）
 */
import type { QueryMyPointRecordDto } from './dto/user-point.dto'
import type {
  QueryMyBadgeDto,
  QueryMyExperienceRecordDto,
  UpdateMyForumProfileDto,
  UpdateMyProfileDto,
} from './dto/user.dto'
import { DrizzleService } from '@db/core'

import { GrowthAssetTypeEnum, UserExperienceService, UserPointService } from '@libs/growth'
import { DownloadTargetTypeEnum, PurchaseStatusEnum, PurchaseTargetTypeEnum } from '@libs/interaction'
import { MessageInboxService } from '@libs/message'
import { UserStatusEnum } from '@libs/platform/constant'

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, gt, gte, inArray, isNull, sql } from 'drizzle-orm'

@Injectable()
export class UserService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly userPointService: UserPointService,
    private readonly userExperienceService: UserExperienceService,
    private readonly messageInboxService: MessageInboxService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  private get forumProfile() {
    return this.drizzle.schema.forumProfile
  }

  private get userBadgeAssignment() {
    return this.drizzle.schema.userBadgeAssignment
  }

  private get userBadge() {
    return this.drizzle.schema.userBadge
  }

  private get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  private get growthLedgerRecord() {
    return this.drizzle.schema.growthLedgerRecord
  }

  private get userComment() {
    return this.drizzle.schema.userComment
  }

  private get userLike() {
    return this.drizzle.schema.userLike
  }

  private get userFavorite() {
    return this.drizzle.schema.userFavorite
  }

  private get userBrowseLog() {
    return this.drizzle.schema.userBrowseLog
  }

  private get userPurchaseRecord() {
    return this.drizzle.schema.userPurchaseRecord
  }

  private get userDownloadRecord() {
    return this.drizzle.schema.userDownloadRecord
  }

  /**
   * 获取用户资料
   *
   * @param userId 用户ID
   * @returns 用户资料信息
   */
  async getUserProfile(userId: number) {
    const [user] = await this.db
      .select()
      .from(this.appUser)
      .where(eq(this.appUser.id, userId))
      .limit(1)

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return this.mapUserProfile(user)
  }

  /**
   * 更新用户资料
   *
   * @param userId 用户ID
   * @param dto 更新数据
   * @returns 更新后的用户资料
   */
  async updateUserProfile(userId: number, dto: UpdateMyProfileDto) {
    await this.ensureUserExists(userId)

    try {
      const [updated] = await this.db
        .update(this.appUser)
        .set({
          nickname: dto.nickname,
          avatarUrl: dto.avatar,
          emailAddress: dto.email,
          genderType: dto.gender,
          birthDate: dto.birthDate
            ? new Date(dto.birthDate).toISOString().slice(0, 10)
            : undefined,
        })
        .where(eq(this.appUser.id, userId))
        .returning()
      if (!updated) {
        throw new NotFoundException('用户不存在')
      }
      return this.mapUserProfile(updated)
    } catch (error) {
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BadRequestException('邮箱已被使用')
      }
      throw error
    }
  }

  /**
   * 获取用户论坛资料
   *
   * @param userId 用户ID
   * @returns 用户论坛资料
   */
  async getUserForumProfile(userId: number) {
    const [user, forumProfile] = await Promise.all([
      this.db
        .select({
          status: this.appUser.status,
          banReason: this.appUser.banReason,
          banUntil: this.appUser.banUntil,
        })
        .from(this.appUser)
        .where(eq(this.appUser.id, userId))
        .limit(1)
        .then((rows) => rows[0]),
      this.db
        .select({
          signature: this.forumProfile.signature,
          bio: this.forumProfile.bio,
          topicCount: this.forumProfile.topicCount,
          replyCount: this.forumProfile.replyCount,
          likeCount: this.forumProfile.likeCount,
          favoriteCount: this.forumProfile.favoriteCount,
        })
        .from(this.forumProfile)
        .where(eq(this.forumProfile.userId, userId))
        .limit(1)
        .then((rows) => rows[0]),
    ])

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return {
      signature: forumProfile?.signature ?? '',
      bio: forumProfile?.bio ?? '',
      topicCount: forumProfile?.topicCount ?? 0,
      replyCount: forumProfile?.replyCount ?? 0,
      likeCount: forumProfile?.likeCount ?? 0,
      favoriteCount: forumProfile?.favoriteCount ?? 0,
      status: user.status,
      banReason: user.banReason ?? undefined,
      banUntil: user.banUntil ?? undefined,
    }
  }

  /**
   * 更新用户论坛资料
   *
   * @param userId 用户ID
   * @param dto 更新数据
   * @returns 更新后的用户论坛资料
   */
  async updateUserForumProfile(userId: number, dto: UpdateMyForumProfileDto) {
    await this.ensureUserExists(userId)

    await this.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: this.forumProfile.id })
        .from(this.forumProfile)
        .where(eq(this.forumProfile.userId, userId))
        .limit(1)
      if (existing[0]) {
        await tx
          .update(this.forumProfile)
          .set({
            signature: dto.signature,
            bio: dto.bio,
          })
          .where(eq(this.forumProfile.userId, userId))
      } else {
        await tx.insert(this.forumProfile).values({
          userId,
          signature: dto.signature ?? '',
          bio: dto.bio ?? '',
        })
      }
    })

    return this.getUserForumProfile(userId)
  }

  /**
   * 获取用户中心汇总信息
   *
   * @param userId 用户ID
   * @returns 用户中心汇总信息
   */
  async getUserCenter(userId: number) {
    const [user, forumProfile, badgeRows, assets, messageSummary] = await Promise.all([
      this.db
        .select()
        .from(this.appUser)
        .where(eq(this.appUser.id, userId))
        .limit(1)
        .then((rows) => rows[0]),
      this.db
        .select({
          topicCount: this.forumProfile.topicCount,
          replyCount: this.forumProfile.replyCount,
          likeCount: this.forumProfile.likeCount,
          favoriteCount: this.forumProfile.favoriteCount,
        })
        .from(this.forumProfile)
        .where(eq(this.forumProfile.userId, userId))
        .limit(1)
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userBadgeAssignment)
        .where(eq(this.userBadgeAssignment.userId, userId)),
      this.getUserAssetsSummary(userId),
      this.messageInboxService.getSummary(userId),
    ])

    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    const [level] = user.levelId
      ? await this.db
          .select({ id: this.userLevelRule.id, name: this.userLevelRule.name })
          .from(this.userLevelRule)
          .where(eq(this.userLevelRule.id, user.levelId))
          .limit(1)
      : []

    return {
      user: {
        id: user.id,
        account: user.account,
        phone: user.phoneNumber ?? undefined,
        nickname: user.nickname,
        avatar: user.avatarUrl ?? undefined,
        email: user.emailAddress ?? undefined,
        gender: user.genderType,
        birthDate: user.birthDate ?? undefined,
      },
      growth: {
        points: user.points,
        experience: user.experience,
        levelId: user.levelId ?? undefined,
        levelName: level?.name ?? undefined,
        badgeCount: Number(badgeRows[0]?.count ?? 0),
      },
      community: {
        status: user.status,
        banReason: user.banReason ?? undefined,
        banUntil: user.banUntil ?? undefined,
        topicCount: forumProfile?.topicCount ?? 0,
        replyCount: forumProfile?.replyCount ?? 0,
        likeCount: forumProfile?.likeCount ?? 0,
        favoriteCount: forumProfile?.favoriteCount ?? 0,
      },
      assets,
      message: {
        notificationUnreadCount: messageSummary.notificationUnreadCount,
        totalUnreadCount: messageSummary.totalUnreadCount,
      },
    }
  }

  /**
   * 获取用户状态信息
   *
   * @param userId 用户ID
   * @returns 用户状态信息
   */
  async getUserStatus(userId: number) {
    const [user] = await this.db
      .select({
        isEnabled: this.appUser.isEnabled,
        status: this.appUser.status,
        banReason: this.appUser.banReason,
        banUntil: this.appUser.banUntil,
      })
      .from(this.appUser)
      .where(eq(this.appUser.id, userId))
      .limit(1)

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return this.buildUserStatus(user)
  }

  /**
   * 获取用户成长汇总
   *
   * @param userId 用户ID
   * @returns 用户成长汇总信息
   */
  async getUserGrowthSummary(userId: number) {
    const [user, pointStats, experienceStats, badgeRows] = await Promise.all([
      this.db
        .select({
          points: this.appUser.points,
          experience: this.appUser.experience,
          levelId: this.appUser.levelId,
        })
        .from(this.appUser)
        .where(eq(this.appUser.id, userId))
        .limit(1)
        .then((rows) => rows[0]),
      this.userPointService.getUserPointStats(userId),
      this.getUserExperienceStats(userId),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userBadgeAssignment)
        .where(eq(this.userBadgeAssignment.userId, userId)),
    ])

    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    const [level] = user.levelId
      ? await this.db
          .select({ name: this.userLevelRule.name })
          .from(this.userLevelRule)
          .where(eq(this.userLevelRule.id, user.levelId))
          .limit(1)
      : []

    return {
      points: user.points,
      experience: user.experience,
      levelId: user.levelId ?? undefined,
      levelName: level?.name ?? undefined,
      badgeCount: Number(badgeRows[0]?.count ?? 0),
      todayPointEarned: pointStats.todayEarned,
      todayExperienceEarned: experienceStats.todayEarned,
    }
  }

  /**
   * 获取用户积分统计
   *
   * @param userId 用户ID
   * @returns 用户积分统计
   */
  async getUserPointStats(userId: number) {
    return this.userPointService.getUserPointStats(userId)
  }

  /**
   * 获取用户积分记录
   *
   * @param userId 用户ID
   * @param query 查询条件
   * @returns 积分记录分页数据
   */
  async getUserPointRecords(userId: number, query: QueryMyPointRecordDto) {
    return this.userPointService.getPointRecordPage({
      ...query,
      userId,
    })
  }

  /**
   * 获取用户经验统计
   *
   * @param userId 用户ID
   * @returns 用户经验统计
   */
  async getUserExperienceStats(userId: number) {
    const [user] = await this.db
      .select({
        experience: this.appUser.experience,
        levelId: this.appUser.levelId,
      })
      .from(this.appUser)
      .where(eq(this.appUser.id, userId))
      .limit(1)

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 获取今日开始时间
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayEarnedRows, levelRows, nextLevelRows] = await Promise.all([
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
      user.levelId
        ? this.db
            .select({
              id: this.userLevelRule.id,
              name: this.userLevelRule.name,
              requiredExperience: this.userLevelRule.requiredExperience,
            })
            .from(this.userLevelRule)
            .where(eq(this.userLevelRule.id, user.levelId))
        : [],
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
    const level = levelRows[0]
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
   * 获取用户经验记录
   *
   * @param userId 用户ID
   * @param query 查询条件
   * @returns 经验记录分页数据
   */
  async getUserExperienceRecords(
    userId: number,
    query: QueryMyExperienceRecordDto,
  ) {
    return this.userExperienceService.getExperienceRecordPage({
      ...query,
      userId,
    })
  }

  /**
   * 获取用户徽章列表
   *
   * @param userId 用户ID
   * @param query 查询条件
   * @returns 徽章列表分页数据
   */
  async getUserBadges(userId: number, query: QueryMyBadgeDto) {
    await this.ensureUserExists(userId)

    const { name, type, isEnabled, business, eventKey, ...pageQuery } = query
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
   * 获取用户资产统计
   *
   * 包括购买、下载、收藏、点赞、浏览、评论等统计数据
   *
   * @param userId 用户ID
   * @returns 用户资产统计
   */
  async getUserAssetsSummary(userId: number) {
    await this.ensureUserExists(userId)

    const [
      commentCount,
      likeCount,
      favoriteCount,
      viewCount,
      purchasedChapterCount,
      downloadedChapterCount,
      purchasedWorkRows,
      downloadedWorkRows,
    ] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userComment)
        .where(and(eq(this.userComment.userId, userId), isNull(this.userComment.deletedAt))),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userLike)
        .where(eq(this.userLike.userId, userId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userFavorite)
        .where(eq(this.userFavorite.userId, userId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userBrowseLog)
        .where(eq(this.userBrowseLog.userId, userId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userPurchaseRecord)
        .where(
          and(
            eq(this.userPurchaseRecord.userId, userId),
            eq(this.userPurchaseRecord.status, PurchaseStatusEnum.SUCCESS),
            inArray(this.userPurchaseRecord.targetType, [
              PurchaseTargetTypeEnum.COMIC_CHAPTER,
              PurchaseTargetTypeEnum.NOVEL_CHAPTER,
            ]),
          ),
        ),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userDownloadRecord)
        .where(
          and(
            eq(this.userDownloadRecord.userId, userId),
            inArray(this.userDownloadRecord.targetType, [
              DownloadTargetTypeEnum.COMIC_CHAPTER,
              DownloadTargetTypeEnum.NOVEL_CHAPTER,
            ]),
          ),
        ),
      this.db.execute(sql`
        SELECT COUNT(DISTINCT wc.work_id)::bigint AS "total"
        FROM user_purchase_record upr
        INNER JOIN work_chapter wc ON wc.id = upr.target_id
        WHERE upr.user_id = ${userId}
          AND upr.status = ${PurchaseStatusEnum.SUCCESS}
          AND upr.target_type IN (${PurchaseTargetTypeEnum.COMIC_CHAPTER}, ${PurchaseTargetTypeEnum.NOVEL_CHAPTER})
      `),
      this.db.execute(sql`
        SELECT COUNT(DISTINCT wc.work_id)::bigint AS "total"
        FROM user_download_record udr
        INNER JOIN work_chapter wc ON wc.id = udr.target_id
        WHERE udr.user_id = ${userId}
          AND udr.target_type IN (${DownloadTargetTypeEnum.COMIC_CHAPTER}, ${DownloadTargetTypeEnum.NOVEL_CHAPTER})
      `),
    ])
    const purchasedRows
      = ((purchasedWorkRows as unknown as { rows?: Array<{ total: bigint }> }).rows
        ?? [])
    const downloadedRows
      = ((downloadedWorkRows as unknown as { rows?: Array<{ total: bigint }> }).rows
        ?? [])

    return {
      purchasedWorkCount: Number(purchasedRows[0]?.total ?? 0n),
      purchasedChapterCount: Number(purchasedChapterCount[0]?.count ?? 0),
      downloadedWorkCount: Number(downloadedRows[0]?.total ?? 0n),
      downloadedChapterCount: Number(downloadedChapterCount[0]?.count ?? 0),
      favoriteCount: Number(favoriteCount[0]?.count ?? 0),
      likeCount: Number(likeCount[0]?.count ?? 0),
      viewCount: Number(viewCount[0]?.count ?? 0),
      commentCount: Number(commentCount[0]?.count ?? 0),
    }
  }

  /**
   * 确保用户存在
   *
   * @param userId 用户ID
   * @throws NotFoundException 用户不存在时抛出异常
   */
  private async ensureUserExists(userId: number) {
    const [user] = await this.db
      .select({ id: this.appUser.id })
      .from(this.appUser)
      .where(eq(this.appUser.id, userId))
      .limit(1)
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
  }

  /**
   * 构建用户状态信息
   *
   * @param user 用户数据对象
   * @param user.isEnabled 账号是否可用
   * @param user.status 社区状态码
   * @param user.banReason 封禁/禁言原因
   * @param user.banUntil 封禁/禁言到期时间
   * @returns 用户状态信息
   */
  private buildUserStatus(user: {
    isEnabled: boolean
    status: number
    banReason: string | null
    banUntil: Date | null
  }) {
    // 被禁止互动的状态集合
    const interactionBlockedStatuses = new Set<number>([
      UserStatusEnum.MUTED,
      UserStatusEnum.PERMANENT_MUTED,
      UserStatusEnum.BANNED,
      UserStatusEnum.PERMANENT_BANNED,
    ])

    const canLogin = user.isEnabled
    const canInteract =
      user.isEnabled && !interactionBlockedStatuses.has(user.status)
    const reason = !user.isEnabled
      ? user.banReason || '账号已被禁用'
      : user.banReason || undefined

    return {
      isEnabled: user.isEnabled,
      status: user.status,
      canLogin,
      canPost: canInteract,
      canReply: canInteract,
      canLike: canInteract,
      canFavorite: canInteract,
      reason,
      until: user.banUntil ?? undefined,
    }
  }

  private mapUserProfile(user: {
    id: number
    createdAt: Date
    updatedAt: Date
    account: string
    phoneNumber: string | null
    nickname: string
    avatarUrl: string | null
    emailAddress: string | null
    isEnabled: boolean
    genderType: number
    birthDate: string | null
    lastLoginAt: Date | null
    lastLoginIp: string | null
    points: number
    experience: number
    levelId: number | null
    status: number
    banReason: string | null
    banUntil: Date | null
  }) {
    return {
      id: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      account: user.account,
      phone: user.phoneNumber ?? undefined,
      nickname: user.nickname,
      avatar: user.avatarUrl ?? undefined,
      email: user.emailAddress ?? undefined,
      isEnabled: user.isEnabled,
      gender: user.genderType,
      birthDate: user.birthDate ? new Date(user.birthDate) : undefined,
      lastLoginAt: user.lastLoginAt ?? undefined,
      lastLoginIp: user.lastLoginIp ?? undefined,
      points: user.points,
      experience: user.experience,
      levelId: user.levelId ?? undefined,
      status: user.status,
      banReason: user.banReason ?? undefined,
      banUntil: user.banUntil ?? undefined,
    }
  }
}
