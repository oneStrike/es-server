import type { Db } from '@db/core'
import type { AppUserCountSelect, AppUserSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { GrowthAssetTypeEnum } from '@libs/growth/growth-ledger/growth-ledger.constant';
import { UserPointService } from '@libs/growth/point/point.service';
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant';
import { FavoriteService } from '@libs/interaction/favorite/favorite.service';
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant';
import { LikeService } from '@libs/interaction/like/like.service';
import { UserDefaults, UserStatusEnum } from '@libs/user/app-user.constant'
import { AppUserCountService } from '@libs/user/app-user-count.service';
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  QueryUserProfileListDto,
  UpdateUserStatusDto,
} from './dto/profile.dto'

type UserCountRow = Pick<
  AppUserCountSelect,
  | 'userId'
  | 'commentCount'
  | 'likeCount'
  | 'favoriteCount'
  | 'followingUserCount'
  | 'followingAuthorCount'
  | 'followingSectionCount'
  | 'followersCount'
  | 'forumTopicCount'
  | 'commentReceivedLikeCount'
  | 'forumTopicReceivedLikeCount'
  | 'forumTopicReceivedFavoriteCount'
>

/**
 * 用户资料服务
 * 提供用户资料、积分记录、收藏等管理功能
 */
@Injectable()
export class UserProfileService {
  constructor(
    private readonly drizzle: DrizzleService,
    /** 用户积分服务 */
    protected readonly pointService: UserPointService,
    /** 收藏服务 */
    protected readonly favoriteService: FavoriteService,
    /** 点赞服务 */
    protected readonly likeService: LikeService,
    private readonly appUserCountService: AppUserCountService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get appUser() {
    return this.drizzle.schema.appUser
  }

  get appUserCount() {
    return this.drizzle.schema.appUserCount
  }

  get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  get growthLedgerRecord() {
    return this.drizzle.schema.growthLedgerRecord
  }

  get userBadge() {
    return this.drizzle.schema.userBadge
  }

  get userBadgeAssignment() {
    return this.drizzle.schema.userBadgeAssignment
  }

  get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  private mapCountRow(counts: UserCountRow | undefined, userId: number) {
    return {
      userId,
      commentCount: counts?.commentCount ?? 0,
      likeCount: counts?.likeCount ?? 0,
      favoriteCount: counts?.favoriteCount ?? 0,
      followingUserCount: counts?.followingUserCount ?? 0,
      followingAuthorCount: counts?.followingAuthorCount ?? 0,
      followingSectionCount: counts?.followingSectionCount ?? 0,
      followersCount: counts?.followersCount ?? 0,
      forumTopicCount: counts?.forumTopicCount ?? 0,
      commentReceivedLikeCount: counts?.commentReceivedLikeCount ?? 0,
      forumTopicReceivedLikeCount: counts?.forumTopicReceivedLikeCount ?? 0,
      forumTopicReceivedFavoriteCount:
        counts?.forumTopicReceivedFavoriteCount ?? 0,
    }
  }

  private mapUser(user: AppUserSelect) {
    return {
      id: user.id,
      account: user.account,
      phoneNumber: user.phoneNumber ?? undefined,
      emailAddress: user.emailAddress ?? undefined,
      levelId: user.levelId ?? undefined,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl ?? undefined,
      signature: user.signature ?? undefined,
      bio: user.bio ?? undefined,
      isEnabled: user.isEnabled,
      genderType: user.genderType,
      birthDate: user.birthDate ?? undefined,
      points: user.points,
      experience: user.experience,
      status: user.status,
      banReason: user.banReason ?? undefined,
      banUntil: user.banUntil ?? undefined,
      lastLoginAt: user.lastLoginAt ?? undefined,
      lastLoginIp: user.lastLoginIp ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt ?? undefined,
    }
  }

  /**
   * 获取论坛主题场景使用的用户简要信息。
   * 仅返回主题列表展示所需的最小字段，避免公开接口暴露过多资料。
   */
  private async getTopicUserBriefById(userId: number) {
    return this.db.query.appUser.findFirst({
      where: { id: userId },
      columns: {
        id: true,
        nickname: true,
        avatarUrl: true,
      },
    })
  }

  /**
   * 构建“我的主题”列表使用的正文摘要 SQL。
   * 直接在数据库侧截取前 60 个字符，避免个人列表读取完整正文。
   */
  private buildTopicContentSnippetSql() {
    return sql<string>`left(trim(${this.forumTopic.content}), 60)`
  }

  /**
   * 查询用户资料列表
   * @param queryDto - 查询参数，包含用户ID、昵称、状态等过滤条件
   * @returns 分页的用户资料列表，包含用户信息和徽章信息
   */
  async queryProfileList(queryDto: QueryUserProfileListDto) {
    const { levelId, status, nickname, ...rest } = queryDto

    const conditions: SQL[] = []

    if (levelId !== undefined) {
      conditions.push(
        levelId === null
          ? isNull(this.appUser.levelId)
          : eq(this.appUser.levelId, levelId),
      )
    }
    if (status !== undefined) {
      conditions.push(eq(this.appUser.status, status))
    }
    if (nickname) {
      conditions.push(
        buildILikeCondition(this.appUser.nickname, nickname)!,
      )
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const page = await this.drizzle.ext.findPagination(this.appUser, {
      where,
      ...rest,
    })
    const userIds = page.list.map((item) => item.id)
    const counts = userIds.length
      ? await this.db
          .select({
            userId: this.appUserCount.userId,
            commentCount: this.appUserCount.commentCount,
            likeCount: this.appUserCount.likeCount,
            favoriteCount: this.appUserCount.favoriteCount,
            followingUserCount: this.appUserCount.followingUserCount,
            followingAuthorCount: this.appUserCount.followingAuthorCount,
            followingSectionCount: this.appUserCount.followingSectionCount,
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
      : []
    const countMap = new Map(counts.map((item) => [item.userId, item]))
    const badgeRows = userIds.length
      ? await this.db
          .select({
            userId: this.userBadgeAssignment.userId,
            createdAt: this.userBadgeAssignment.createdAt,
            badge: this.userBadge,
          })
          .from(this.userBadgeAssignment)
          .innerJoin(
            this.userBadge,
            eq(this.userBadge.id, this.userBadgeAssignment.badgeId),
          )
          .where(inArray(this.userBadgeAssignment.userId, userIds))
          .orderBy(
            asc(this.userBadgeAssignment.userId),
            desc(this.userBadgeAssignment.createdAt),
            asc(this.userBadgeAssignment.badgeId),
          )
      : []
    const badgeMap = new Map<number, any[]>()
    for (const row of badgeRows) {
      const list = badgeMap.get(row.userId) ?? []
      list.push({ createdAt: row.createdAt, badge: row.badge })
      badgeMap.set(row.userId, list)
    }

    const list = page.list.map((item) => {
      return {
        ...this.mapUser(item),
        avatar: item.avatarUrl ?? undefined,
        counts: this.mapCountRow(countMap.get(item.id), item.id),
        userBadges: badgeMap.get(item.id) ?? [],
      }
    })
    return { ...page, list }
  }

  /**
   * 查看用户资料
   * @param userId - 用户ID
   * @returns 用户资料详情，包含用户信息和徽章信息
   * @throws Error 用户不存在
   */
  async getProfile(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }
    const [counts] = await this.db
      .select({
        userId: this.appUserCount.userId,
        commentCount: this.appUserCount.commentCount,
        likeCount: this.appUserCount.likeCount,
        favoriteCount: this.appUserCount.favoriteCount,
        followingUserCount: this.appUserCount.followingUserCount,
        followingAuthorCount: this.appUserCount.followingAuthorCount,
        followingSectionCount: this.appUserCount.followingSectionCount,
        followersCount: this.appUserCount.followersCount,
        forumTopicCount: this.appUserCount.forumTopicCount,
        commentReceivedLikeCount: this.appUserCount.commentReceivedLikeCount,
        forumTopicReceivedLikeCount:
          this.appUserCount.forumTopicReceivedLikeCount,
        forumTopicReceivedFavoriteCount:
          this.appUserCount.forumTopicReceivedFavoriteCount,
      })
      .from(this.appUserCount)
      .where(eq(this.appUserCount.userId, userId))
    const userBadges = await this.db
      .select({
        userId: this.userBadgeAssignment.userId,
        badgeId: this.userBadgeAssignment.badgeId,
        createdAt: this.userBadgeAssignment.createdAt,
        badge: this.userBadge,
      })
      .from(this.userBadgeAssignment)
      .innerJoin(
        this.userBadge,
        eq(this.userBadge.id, this.userBadgeAssignment.badgeId),
      )
      .where(eq(this.userBadgeAssignment.userId, userId))
      .orderBy(
        desc(this.userBadgeAssignment.createdAt),
        asc(this.userBadgeAssignment.badgeId),
      )
    return {
      ...this.mapUser(user),
      avatar: user.avatarUrl ?? undefined,
      counts: this.mapCountRow(counts, userId),
      userBadges,
    }
  }

  /**
   * 更新用户资料状态
   * @param updateDto - 更新参数，包含用户ID、状态和封禁原因
   * @throws Error 用户不存在
   */
  async updateProfileStatus(updateDto: UpdateUserStatusDto): Promise<void> {
    const { id: userId, status, banReason, banUntil } = updateDto

    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appUser)
        .set({ status, banReason, banUntil })
        .where(eq(this.appUser.id, userId)),
    )
  }

  /**
   * 查看我的主题，并补充当前用户对这些主题的交互状态、用户简要信息与板块简要信息。
   * @param userId - 用户ID
   * @returns 分页的主题列表，包含板块信息、liked/favorited 状态和发帖用户简要信息
   */
  async getMyTopics(
    userId: number,
    query?: {
      sectionId?: number
      pageIndex?: number
      pageSize?: number
      orderBy?: string
    },
  ) {
    const conditions: SQL[] = [
      eq(this.forumTopic.userId, userId),
      isNull(this.forumTopic.deletedAt),
    ]

    if (query?.sectionId !== undefined) {
      conditions.push(eq(this.forumTopic.sectionId, query.sectionId))
    }

    const where = and(...conditions)
    const pageQuery = this.drizzle.buildPage({
      pageIndex: query?.pageIndex,
      pageSize: query?.pageSize,
    })
    const order = this.drizzle.buildOrderBy(query?.orderBy, {
      table: this.forumTopic,
      fallbackOrderBy: { createdAt: 'desc' },
    })
    const listQuery = this.db
      .select({
        id: this.forumTopic.id,
        sectionId: this.forumTopic.sectionId,
        userId: this.forumTopic.userId,
        title: this.forumTopic.title,
        contentSnippet: this.buildTopicContentSnippetSql(),
        geoCountry: this.forumTopic.geoCountry,
        geoProvince: this.forumTopic.geoProvince,
        geoCity: this.forumTopic.geoCity,
        geoIsp: this.forumTopic.geoIsp,
        geoSource: this.forumTopic.geoSource,
        images: this.forumTopic.images,
        videos: this.forumTopic.videos,
        isPinned: this.forumTopic.isPinned,
        isFeatured: this.forumTopic.isFeatured,
        isLocked: this.forumTopic.isLocked,
        viewCount: this.forumTopic.viewCount,
        commentCount: this.forumTopic.commentCount,
        likeCount: this.forumTopic.likeCount,
        favoriteCount: this.forumTopic.favoriteCount,
        lastCommentAt: this.forumTopic.lastCommentAt,
        createdAt: this.forumTopic.createdAt,
        auditStatus: this.forumTopic.auditStatus,
      })
      .from(this.forumTopic)
      .where(where)
      .limit(pageQuery.limit)
      .offset(pageQuery.offset)
    const [pageList, total] = await Promise.all([
      order.orderBySql.length > 0
        ? listQuery.orderBy(...order.orderBySql)
        : listQuery,
      this.db.$count(this.forumTopic, where),
    ])
    const page = {
      list: pageList,
      total,
      pageIndex: pageQuery.pageIndex,
      pageSize: pageQuery.pageSize,
    }

    if (page.list.length === 0) {
      return page
    }

    const topicIds = page.list.map((item) => item.id)
    const sectionIds = [
      ...new Set(page.list.map((item) => item.sectionId).filter((id) => !!id)),
    ]
    const [likedMap, favoritedMap, sections, user] = await Promise.all([
      this.likeService.checkStatusBatch(
        LikeTargetTypeEnum.FORUM_TOPIC,
        topicIds,
        userId,
      ),
      this.favoriteService.checkStatusBatch(
        FavoriteTargetTypeEnum.FORUM_TOPIC,
        topicIds,
        userId,
      ),
      sectionIds.length
        ? this.db
            .select({
              id: this.forumSection.id,
              name: this.forumSection.name,
              icon: this.forumSection.icon,
              cover: this.forumSection.cover,
            })
            .from(this.forumSection)
            .where(
              and(
                inArray(this.forumSection.id, sectionIds),
                isNull(this.forumSection.deletedAt),
              ),
            )
        : Promise.resolve<
            Array<{
              id: number
              name: string
              icon: string | null
              cover: string | null
            }>
          >([]),
      this.getTopicUserBriefById(userId),
    ])
    const sectionMap = new Map(sections.map((item) => [item.id, item]))
    const list = page.list.map((item) => {
      return {
        ...item,
        geoCountry: item.geoCountry ?? undefined,
        geoProvince: item.geoProvince ?? undefined,
        geoCity: item.geoCity ?? undefined,
        geoIsp: item.geoIsp ?? undefined,
        geoSource: item.geoSource ?? undefined,
        liked: likedMap.get(item.id) ?? false,
        favorited: favoritedMap.get(item.id) ?? false,
        user,
        section: item.sectionId
          ? (sectionMap.get(item.sectionId) ?? null)
          : null,
      }
    })
    return { ...page, list }
  }

  /**
   * 获取我的收藏
   * @param userId - 用户ID
   * @returns 分页的收藏列表，包含主题信息
   */
  async getMyFavorites(userId: number) {
    const result = await this.favoriteService.getUserTopicFavorites({
      userId,
    })

    if (result.list.length === 0) {
      return { list: [], total: result.total }
    }

    const topicIds = result.list.map((f) => f.targetId)
    const topics = await this.db
      .select()
      .from(this.forumTopic)
      .where(inArray(this.forumTopic.id, topicIds))
    const sectionIds = topics.map((item) => item.sectionId).filter((id) => !!id)
    const sections = sectionIds.length
      ? await this.db
          .select({ id: this.forumSection.id, name: this.forumSection.name })
          .from(this.forumSection)
          .where(inArray(this.forumSection.id, sectionIds))
      : []
    const sectionMap = new Map(sections.map((item) => [item.id, item]))
    const topicsWithSection = topics.map((item) => ({
      ...item,
      section: item.sectionId ? (sectionMap.get(item.sectionId) ?? null) : null,
    }))

    const topicMap = new Map(topicsWithSection.map((t) => [t.id, t]))
    const orderedTopics = topicIds
      .map((id) => topicMap.get(id))
      .filter(Boolean) as Array<{ id: number }>

    return {
      list: orderedTopics.map((topic) => ({
        topic,
        createdAt: result.list.find((f) => f.targetId === topic.id)?.createdAt,
      })),
      total: result.total,
    }
  }

  /**
   * 查看积分记录
   * @param userId - 用户ID
   * @returns 分页的积分记录列表
   */
  async getPointRecords(userId: number) {
    const page = await this.drizzle.ext.findPagination(
      this.growthLedgerRecord,
      {
        where: and(
          eq(this.growthLedgerRecord.userId, userId),
          eq(this.growthLedgerRecord.assetType, GrowthAssetTypeEnum.POINTS),
        ),
        orderBy: { id: 'desc' },
      },
    )
    return {
      ...page,
      list: page.list.map((item) => ({
        id: item.id,
        userId: item.userId,
        ruleId: item.ruleId ?? undefined,
        points: item.delta,
        beforePoints: item.beforeValue,
        afterPoints: item.afterValue,
        remark: item.remark ?? undefined,
        createdAt: item.createdAt,
      })),
    }
  }

  /**
   * 初始化用户资料
   * @param tx - 事务客户端
   * @param userId - 用户 ID
   * @throws {BadRequestException} 系统配置错误：找不到默认论坛等级
   */
  async initUserProfile(tx: Db | undefined, userId: number) {
    const client = tx ?? this.db
    const [defaultLevel] = await client
      .select({ id: this.userLevelRule.id })
      .from(this.userLevelRule)
      .where(eq(this.userLevelRule.isEnabled, true))
      .orderBy(asc(this.userLevelRule.sortOrder), asc(this.userLevelRule.id))
      .limit(1)

    await client
      .update(this.appUser)
      .set({
        points: UserDefaults.INITIAL_POINTS,
        experience: UserDefaults.INITIAL_EXPERIENCE,
        levelId: defaultLevel?.id ?? null,
        status: UserStatusEnum.NORMAL,
        signature: '',
        bio: '',
      })
      .where(eq(this.appUser.id, userId))

    await this.appUserCountService.initUserCounts(client, userId)
  }
}
