import type { Db } from '@db/core'
import type { AppUserSelect } from '@db/schema'

import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { GrowthAssetTypeEnum } from '@libs/growth/growth-ledger/growth-ledger.constant'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { FavoriteService } from '@libs/interaction/favorite/favorite.service'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { LikeService } from '@libs/interaction/like/like.service'
import { AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { AppUserCountService } from '@libs/user/app-user-count.service'
import { UserDefaults, UserStatusEnum } from '@libs/user/app-user.constant'
import { Injectable } from '@nestjs/common'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { ForumPermissionService } from '../permission/forum-permission.service'
import { QueryUserProfileListDto, UpdateUserStatusDto } from './dto/profile.dto'
import {
  MyProfileTopicPageQuery,
  ProfileGrowthSnapshot,
  ProfileTopicSectionBrief,
  ProfileUserBadgeRow,
  ProfileUserCountRow,
  PublicUserProfileTopicPageQuery,
} from './profile.type'

/**
 * 用户资料服务
 * 提供用户资料、积分记录、收藏等管理功能
 */
@Injectable()
export class UserProfileService {
  constructor(
    private readonly drizzle: DrizzleService,
    /** 收藏服务 */
    protected readonly favoriteService: FavoriteService,
    /** 点赞服务 */
    protected readonly likeService: LikeService,
    private readonly appUserCountService: AppUserCountService,
    private readonly forumPermissionService: ForumPermissionService,
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

  get userAssetBalance() {
    return this.drizzle.schema.userAssetBalance
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

  // 将用户计数读模型映射为稳定的 profile 聚合结构。
  private mapCountRow(counts: ProfileUserCountRow | undefined, userId: number) {
    return {
      userId,
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

  // 将 app_user 行与成长快照映射为 profile 侧稳定用户视图。
  private mapUser(user: AppUserSelect, growth: ProfileGrowthSnapshot) {
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
      points: growth.points,
      experience: growth.experience,
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

  // 获取论坛主题场景使用的用户简要信息。
  // 仅返回主题列表展示所需的最小字段，避免公开接口暴露过多资料。
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

  // 构建用户主题列表使用的正文摘要 SQL。
  // 直接在数据库侧截取前 60 个字符，避免列表读取完整正文。
  private buildTopicContentSnippetSql() {
    return sql<string>`left(trim(${this.forumTopic.content}), 60)`
  }

  // 复用 profile 模块统一的用户计数查询字段，避免多处手写后再次漂移。
  private buildUserCountSelect() {
    return {
      userId: this.appUserCount.userId,
      commentCount: this.appUserCount.commentCount,
      likeCount: this.appUserCount.likeCount,
      favoriteCount: this.appUserCount.favoriteCount,
      followingUserCount: this.appUserCount.followingUserCount,
      followingAuthorCount: this.appUserCount.followingAuthorCount,
      followingSectionCount: this.appUserCount.followingSectionCount,
      followingHashtagCount: this.appUserCount.followingHashtagCount,
      followersCount: this.appUserCount.followersCount,
      forumTopicCount: this.appUserCount.forumTopicCount,
      commentReceivedLikeCount: this.appUserCount.commentReceivedLikeCount,
      forumTopicReceivedLikeCount:
        this.appUserCount.forumTopicReceivedLikeCount,
      forumTopicReceivedFavoriteCount:
        this.appUserCount.forumTopicReceivedFavoriteCount,
    }
  }

  // 按用户 ID 列表批量读取 profile 计数快照。
  private async getUserCountRowsByUserIds(userIds: number[]) {
    if (userIds.length === 0) {
      return [] as ProfileUserCountRow[]
    }

    return this.db
      .select(this.buildUserCountSelect())
      .from(this.appUserCount)
      .where(inArray(this.appUserCount.userId, userIds))
  }

  // 读取单个用户的 profile 计数快照。
  private async getUserCountRow(userId: number) {
    const [count] = await this.db
      .select(this.buildUserCountSelect())
      .from(this.appUserCount)
      .where(eq(this.appUserCount.userId, userId))

    return count
  }

  // 解析公开用户主题页在当前查看者语义下可访问的板块范围。
  // 统一复用论坛公开访问规则，不再混合“我的全部主题”语义。
  private async resolvePublicUserTopicVisibleSectionIds(
    viewerUserId?: number,
    query?: PublicUserProfileTopicPageQuery,
  ) {
    if (query?.sectionId !== undefined) {
      await this.forumPermissionService.ensureUserCanAccessSection(
        query.sectionId,
        viewerUserId,
        {
          requireEnabled: true,
          notFoundMessage: '板块不存在',
        },
      )
      return [query.sectionId]
    }

    return this.forumPermissionService.getAccessibleSectionIds(viewerUserId)
  }

  // 查询用户资料列表。
  // 聚合用户基础资料、计数快照、徽章与成长余额。
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
      conditions.push(buildILikeCondition(this.appUser.nickname, nickname)!)
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const page = await this.drizzle.ext.findPagination(this.appUser, {
      where,
      ...rest,
    })
    const userIds = page.list.map((item) => item.id)
    const counts = await this.getUserCountRowsByUserIds(userIds)
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
    const badgeMap = new Map<number, ProfileUserBadgeRow[]>()
    for (const row of badgeRows) {
      const list = badgeMap.get(row.userId) ?? []
      list.push({ createdAt: row.createdAt, badge: row.badge })
      badgeMap.set(row.userId, list)
    }

    const growthMap = await this.buildGrowthSnapshotMap(
      page.list.map((item) => item.id),
    )

    const list = page.list.map((item) => {
      const growth = growthMap.get(item.id) ?? { points: 0, experience: 0 }
      return {
        ...this.mapUser(item, growth),
        avatar: item.avatarUrl ?? undefined,
        counts: this.mapCountRow(countMap.get(item.id), item.id),
        userBadges: badgeMap.get(item.id) ?? [],
      }
    })
    return { ...page, list }
  }

  // 查看用户资料。
  // 返回基础资料、计数快照、成长余额与用户徽章。
  async getProfile(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
    })

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
    const growth = await this.getGrowthSnapshot(user.id)
    const counts = await this.getUserCountRow(userId)
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
      ...this.mapUser(user, growth),
      avatar: user.avatarUrl ?? undefined,
      counts: this.mapCountRow(counts, userId),
      userBadges,
    }
  }

  // 更新用户资料状态。
  // 仅允许修改状态及其封禁附属字段。
  async updateProfileStatus(updateDto: UpdateUserStatusDto): Promise<void> {
    const { id: userId, status, banReason, banUntil } = updateDto

    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
    })

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }

    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appUser)
        .set({ status, banReason, banUntil })
        .where(eq(this.appUser.id, userId)),
    )
  }

  // 查看指定用户发布的公开主题。
  // 始终复用 forum public topic 的可见性约束，不混入“我的主题”私有视图。
  async getPublicUserTopics(
    targetUserId: number,
    viewerUserId?: number,
    query?: PublicUserProfileTopicPageQuery,
  ) {
    const pageQuery = this.drizzle.buildPage({
      pageIndex: query?.pageIndex,
      pageSize: query?.pageSize,
    })
    const visibleSectionIds =
      await this.resolvePublicUserTopicVisibleSectionIds(viewerUserId, query)

    if (visibleSectionIds.length === 0) {
      return {
        list: [],
        total: 0,
        pageIndex: pageQuery.pageIndex,
        pageSize: pageQuery.pageSize,
      }
    }

    const conditions: SQL[] = [
      eq(this.forumTopic.userId, targetUserId),
      isNull(this.forumTopic.deletedAt),
      eq(this.forumTopic.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.forumTopic.isHidden, false),
      inArray(this.forumTopic.sectionId, visibleSectionIds),
    ]

    if (query?.sectionId !== undefined) {
      conditions.push(eq(this.forumTopic.sectionId, query.sectionId))
    }

    const where = and(...conditions)
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
      viewerUserId
        ? this.likeService.checkStatusBatch(
            LikeTargetTypeEnum.FORUM_TOPIC,
            topicIds,
            viewerUserId,
          )
        : Promise.resolve(new Map<number, boolean>()),
      viewerUserId
        ? this.favoriteService.checkStatusBatch(
            FavoriteTargetTypeEnum.FORUM_TOPIC,
            topicIds,
            viewerUserId,
          )
        : Promise.resolve(new Map<number, boolean>()),
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
        : Promise.resolve<ProfileTopicSectionBrief[]>([]),
      this.getTopicUserBriefById(targetUserId),
    ])
    const sectionMap = new Map(sections.map((item) => [item.id, item]))
    const list = page.list
      .map((item) => {
        const section = item.sectionId
          ? (sectionMap.get(item.sectionId) ?? null)
          : null

        if (!section) {
          return null
        }

        return {
          ...item,
          geoCountry: item.geoCountry ?? undefined,
          geoProvince: item.geoProvince ?? undefined,
          geoCity: item.geoCity ?? undefined,
          geoIsp: item.geoIsp ?? undefined,
          liked: likedMap.get(item.id) ?? false,
          favorited: favoritedMap.get(item.id) ?? false,
          user,
          section,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
    return { ...page, list }
  }

  // 查看我的论坛主题。
  // 返回当前用户全部未删除主题，并保留治理状态供自助管理使用。
  async getMyTopics(userId: number, query?: MyProfileTopicPageQuery) {
    const pageQuery = this.drizzle.buildPage({
      pageIndex: query?.pageIndex,
      pageSize: query?.pageSize,
    })
    const conditions: SQL[] = [
      eq(this.forumTopic.userId, userId),
      isNull(this.forumTopic.deletedAt),
    ]

    if (query?.sectionId !== undefined) {
      conditions.push(eq(this.forumTopic.sectionId, query.sectionId))
    }

    const where = and(...conditions)
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
        : Promise.resolve<ProfileTopicSectionBrief[]>([]),
      this.getTopicUserBriefById(userId),
    ])
    const sectionMap = new Map(sections.map((item) => [item.id, item]))
    const list = page.list.map((item) => {
      const section = item.sectionId
        ? (sectionMap.get(item.sectionId) ?? null)
        : null

      return {
        ...item,
        geoCountry: item.geoCountry ?? undefined,
        geoProvince: item.geoProvince ?? undefined,
        geoCity: item.geoCity ?? undefined,
        geoIsp: item.geoIsp ?? undefined,
        liked: likedMap.get(item.id) ?? false,
        favorited: favoritedMap.get(item.id) ?? false,
        user,
        section,
      }
    })
    return { ...page, list }
  }

  // 获取我的收藏。
  // 返回当前用户收藏的论坛主题及收藏时间。
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
      .filter((topic): topic is NonNullable<typeof topic> => Boolean(topic))

    return {
      list: orderedTopics.map((topic) => ({
        topic,
        createdAt: result.list.find((f) => f.targetId === topic.id)?.createdAt,
      })),
      total: result.total,
    }
  }

  // 查看积分记录。
  // 仅返回 points 资产对应的成长流水。
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

  // 初始化用户资料。
  // 为新用户补齐默认等级、成长余额与计数读模型。
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
        levelId: defaultLevel?.id ?? null,
        status: UserStatusEnum.NORMAL,
        signature: '',
        bio: '',
      })
      .where(eq(this.appUser.id, userId))

    await client
      .insert(this.userAssetBalance)
      .values([
        {
          userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          assetKey: '',
          balance: UserDefaults.INITIAL_POINTS,
        },
        {
          userId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          assetKey: '',
          balance: UserDefaults.INITIAL_EXPERIENCE,
        },
      ])
      .onConflictDoNothing()

    await this.appUserCountService.initUserCounts(client, userId)
  }

  // 读取单个用户的成长余额快照。
  private async getGrowthSnapshot(
    userId: number,
  ): Promise<ProfileGrowthSnapshot> {
    const rows = await this.db
      .select({
        assetType: this.userAssetBalance.assetType,
        balance: this.userAssetBalance.balance,
      })
      .from(this.userAssetBalance)
      .where(
        and(
          eq(this.userAssetBalance.userId, userId),
          inArray(this.userAssetBalance.assetType, [
            GrowthAssetTypeEnum.POINTS,
            GrowthAssetTypeEnum.EXPERIENCE,
          ]),
          eq(this.userAssetBalance.assetKey, ''),
        ),
      )

    return {
      points:
        rows.find((item) => item.assetType === GrowthAssetTypeEnum.POINTS)
          ?.balance ?? 0,
      experience:
        rows.find((item) => item.assetType === GrowthAssetTypeEnum.EXPERIENCE)
          ?.balance ?? 0,
    }
  }

  // 按用户 ID 列表批量构建成长余额快照。
  private async buildGrowthSnapshotMap(
    userIds: number[],
  ): Promise<Map<number, ProfileGrowthSnapshot>> {
    const uniqueUserIds = [...new Set(userIds)]
    if (uniqueUserIds.length === 0) {
      return new Map<number, ProfileGrowthSnapshot>()
    }

    const rows = await this.db
      .select({
        userId: this.userAssetBalance.userId,
        assetType: this.userAssetBalance.assetType,
        balance: this.userAssetBalance.balance,
      })
      .from(this.userAssetBalance)
      .where(
        and(
          inArray(this.userAssetBalance.userId, uniqueUserIds),
          inArray(this.userAssetBalance.assetType, [
            GrowthAssetTypeEnum.POINTS,
            GrowthAssetTypeEnum.EXPERIENCE,
          ]),
          eq(this.userAssetBalance.assetKey, ''),
        ),
      )

    const growthMap = new Map<number, ProfileGrowthSnapshot>()
    for (const userId of uniqueUserIds) {
      growthMap.set(userId, { points: 0, experience: 0 })
    }
    for (const row of rows) {
      const current = growthMap.get(row.userId) ?? {
        points: 0,
        experience: 0,
      }
      if (row.assetType === GrowthAssetTypeEnum.POINTS) {
        current.points = row.balance
      } else if (row.assetType === GrowthAssetTypeEnum.EXPERIENCE) {
        current.experience = row.balance
      }
      growthMap.set(row.userId, current)
    }

    return growthMap
  }
}
