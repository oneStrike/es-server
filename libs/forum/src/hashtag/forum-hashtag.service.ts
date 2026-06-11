import type { SQL } from 'drizzle-orm'
import type {
  ForumHashtagSelect,
} from '@db/schema'
import type {
  CreateForumHashtagInput,
  ForumHashtagAdminPageQuery,
  ForumHashtagHotPageQuery,
  ForumHashtagLinkedContentPageQuery,
  ForumHashtagVisibilityState,
  UpdateForumHashtagAuditStatusInput,
  UpdateForumHashtagAuditStatusOptions,
  UpdateForumHashtagHiddenInput,
  UpdateForumHashtagInput,
} from './forum-hashtag.type'
import { DrizzleService, toPageResult } from '@db/core'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { FavoriteService } from '@libs/interaction/favorite/favorite.service'
import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { FollowService } from '@libs/interaction/follow/follow.service'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { LikeService } from '@libs/interaction/like/like.service'
import { AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, desc, eq, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { ForumPermissionService } from '../permission/forum-permission.service'
import {
  FORUM_HASHTAG_DEFAULT_SEARCH_LIMIT,
  ForumHashtagCreateSourceTypeEnum,
  ForumHashtagReferenceSourceTypeEnum,
} from './forum-hashtag.constant'

/**
 * forum 话题资源服务。
 * 统一承载 admin/app 查询、治理和热门排序逻辑。
 */
@Injectable()
export class ForumHashtagService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly followService: FollowService,
    private readonly likeService: LikeService,
    private readonly favoriteService: FavoriteService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get forumHashtag() {
    return this.drizzle.schema.forumHashtag
  }

  private get forumHashtagReference() {
    return this.drizzle.schema.forumHashtagReference
  }

  private get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  private get userComment() {
    return this.drizzle.schema.userComment
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  private get forumSection() {
    return this.drizzle.schema.forumSection
  }

  // 判断 hashtag 是否公开可见。
  private isPublic(hashtag: ForumHashtagVisibilityState) {
    return (
      hashtag.auditStatus === AuditStatusEnum.APPROVED &&
      hashtag.isHidden === false &&
      hashtag.deletedAt === null
    )
  }

  // 归一化 forum 话题 slug。
  private normalizeSlug(displayName: string) {
    return displayName.normalize('NFKC').trim().replace(/^#/, '').toLowerCase()
  }

  // 生成热门分值 SQL。
  private buildHotScoreSql() {
    return sql<number>`(${this.forumHashtag.manualBoost} * 1000 + ${this.forumHashtag.topicRefCount} * 8 + ${this.forumHashtag.commentRefCount} * 3 + ${this.forumHashtag.followerCount} * 5)::int`
  }

  private assertPublicCursorPageQuery(query: Record<string, unknown>) {
    const unsupportedFields = ['pageIndex', 'orderBy', 'startDate', 'endDate']
      .filter((field) => query[field] !== undefined)

    if (unsupportedFields.length > 0) {
      throw new BadRequestException(
        `公开话题分页仅支持 pageSize 和 cursor 查询，不支持 ${unsupportedFields.join(', ')}`,
      )
    }
  }

  private buildCursorPage(query: { pageSize: number }) {
    return this.drizzle.buildPage({ pageIndex: 1, pageSize: query.pageSize })
  }

  private encodeCursor(payload: Record<string, unknown>) {
    return Buffer.from(JSON.stringify(payload)).toString('base64url')
  }

  private parseCursor<T extends Record<string, unknown>>(
    cursor: string | null | undefined,
    validator: (payload: Record<string, unknown>) => T,
    message: string,
  ) {
    if (!cursor?.trim()) {
      return null
    }

    try {
      const parsed = JSON.parse(
        Buffer.from(cursor.trim(), 'base64url').toString('utf8'),
      )
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new TypeError('invalid cursor payload')
      }
      return validator(parsed as Record<string, unknown>)
    }
    catch {
      throw new BadRequestException(message)
    }
  }

  private parseDateIdCursor(cursor?: string | null) {
    return this.parseCursor(
      cursor,
      (payload) => {
        const createdAt = new Date(String(payload.createdAt))
        const id = Number(payload.id)
        if (!Number.isInteger(id) || id < 1 || Number.isNaN(createdAt.getTime())) {
          throw new TypeError('invalid date id cursor')
        }
        return { createdAt, id }
      },
      '话题分页游标非法',
    )
  }

  private buildDateIdDescCursorWhere(cursor: { createdAt: Date, id: number }) {
    return or(
      lt(this.forumHashtagReference.createdAt, cursor.createdAt),
      and(
        eq(this.forumHashtagReference.createdAt, cursor.createdAt),
        lt(this.forumHashtagReference.id, cursor.id),
      ),
    )
  }

  private parseHotHashtagCursor(cursor?: string | null) {
    return this.parseCursor(
      cursor,
      (payload) => {
        const hotScore = Number(payload.hotScore)
        const lastReferencedAt =
          payload.lastReferencedAt === null
            ? new Date(0)
            : new Date(String(payload.lastReferencedAt))
        const id = Number(payload.id)
        if (
          !Number.isFinite(hotScore) ||
          !Number.isInteger(id) ||
          id < 1 ||
          Number.isNaN(lastReferencedAt.getTime())
        ) {
          throw new TypeError('invalid hot hashtag cursor')
        }
        return { hotScore, lastReferencedAt, id }
      },
      '热门话题分页游标非法',
    )
  }

  private buildHotHashtagCursorWhere(
    cursor: { hotScore: number, lastReferencedAt: Date, id: number },
    hotScoreSql: SQL<number>,
  ) {
    const lastReferencedAtSql = sql<Date>`coalesce(${this.forumHashtag.lastReferencedAt}, '1970-01-01'::timestamptz)`

    return or(
      sql`${hotScoreSql} < ${cursor.hotScore}`,
      and(
        sql`${hotScoreSql} = ${cursor.hotScore}`,
        sql`${lastReferencedAtSql} < ${cursor.lastReferencedAt}`,
      ),
      and(
        sql`${hotScoreSql} = ${cursor.hotScore}`,
        sql`${lastReferencedAtSql} = ${cursor.lastReferencedAt}`,
        lt(this.forumHashtag.id, cursor.id),
      ),
    )
  }

  private toAdminForumHashtagDto(hashtag: ForumHashtagSelect) {
    return {
      id: hashtag.id,
      slug: hashtag.slug,
      displayName: hashtag.displayName,
      description: hashtag.description ?? null,
      manualBoost: hashtag.manualBoost,
      auditStatus: hashtag.auditStatus,
      isHidden: hashtag.isHidden,
      auditById: hashtag.auditById ?? null,
      auditRole: hashtag.auditRole ?? null,
      auditReason: hashtag.auditReason ?? null,
      auditAt: hashtag.auditAt ?? null,
      createSourceType: hashtag.createSourceType,
      createdByUserId: hashtag.createdByUserId ?? null,
      sensitiveWordHits: hashtag.sensitiveWordHits ?? null,
      topicRefCount: hashtag.topicRefCount,
      commentRefCount: hashtag.commentRefCount,
      followerCount: hashtag.followerCount,
      lastReferencedAt: hashtag.lastReferencedAt ?? null,
      createdAt: hashtag.createdAt,
      updatedAt: hashtag.updatedAt,
    }
  }

  // 解析话题列表分页项的当前用户关注状态。
  private async getFollowedMap(hashtagIds: number[], userId?: number) {
    if (!userId || hashtagIds.length === 0) {
      return new Map<number, boolean>()
    }

    return this.followService.checkStatusBatch(
      FollowTargetTypeEnum.FORUM_HASHTAG,
      hashtagIds,
      userId,
    )
  }

  // 获取公开 topic 列表装配所需的用户简要信息。
  private async getTopicUserBriefMap(userIds: number[]) {
    const uniqueUserIds = [...new Set(userIds)]
    if (uniqueUserIds.length === 0) {
      return new Map()
    }

    const users = await this.db.query.appUser.findMany({
      where: {
        id: { in: uniqueUserIds },
      },
      columns: {
        id: true,
        nickname: true,
        avatarUrl: true,
      },
    })

    return new Map(users.map((user) => [user.id, user] as const))
  }

  // 获取公开 topic 列表装配所需的板块简要信息。
  private async getTopicSectionBriefMap(sectionIds: number[]) {
    const uniqueSectionIds = [...new Set(sectionIds)]
    if (uniqueSectionIds.length === 0) {
      return new Map()
    }

    const sections = await this.db.query.forumSection.findMany({
      where: {
        id: { in: uniqueSectionIds },
        isEnabled: true,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        name: true,
        icon: true,
        cover: true,
      },
    })

    return new Map(sections.map((section) => [section.id, section] as const))
  }

  /**
   * 管理端创建话题资源。
   * 资源创建后名称不可变，因此这里只允许创建时写 displayName。
   */
  async createHashtag(input: CreateForumHashtagInput, adminUserId: number) {
    const displayName = input.displayName.normalize('NFKC').trim()
    const slug = this.normalizeSlug(displayName)
    if (!displayName || !slug) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '话题名称不能为空',
      )
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.forumHashtag).values({
          slug,
          displayName,
          description: input.description?.trim() || null,
          manualBoost: input.manualBoost ?? 0,
          auditStatus: AuditStatusEnum.APPROVED,
          isHidden: false,
          createSourceType: ForumHashtagCreateSourceTypeEnum.ADMIN,
          createdByUserId: adminUserId,
        }),
      {
        duplicate: '话题已存在',
      },
    )

    return true
  }

  // 更新话题资源的可运营字段。
  async updateHashtag(input: UpdateForumHashtagInput) {
    const result = await this.db
      .update(this.forumHashtag)
      .set({
        description: input.description?.trim() || null,
        manualBoost: input.manualBoost ?? 0,
      })
      .where(
        and(
          eq(this.forumHashtag.id, input.id),
          isNull(this.forumHashtag.deletedAt),
        ),
      )

    this.drizzle.assertAffectedRows(result, '话题不存在')
    return true
  }

  // 更新话题隐藏状态。
  async updateHashtagHidden(input: UpdateForumHashtagHiddenInput) {
    const result = await this.db
      .update(this.forumHashtag)
      .set({
        isHidden: input.isHidden,
      })
      .where(
        and(
          eq(this.forumHashtag.id, input.id),
          isNull(this.forumHashtag.deletedAt),
        ),
      )

    this.drizzle.assertAffectedRows(result, '话题不存在')
    return true
  }

  // 更新话题审核状态。
  async updateHashtagAuditStatus(
    input: UpdateForumHashtagAuditStatusInput,
    options?: UpdateForumHashtagAuditStatusOptions,
  ) {
    const result = await this.db
      .update(this.forumHashtag)
      .set({
        auditStatus: input.auditStatus,
        auditReason: input.auditReason?.trim() || null,
        auditById: options?.auditById ?? null,
        auditRole: options?.auditRole ?? null,
        auditAt: new Date(),
      })
      .where(
        and(
          eq(this.forumHashtag.id, input.id),
          isNull(this.forumHashtag.deletedAt),
        ),
      )

    this.drizzle.assertAffectedRows(result, '话题不存在')
    return true
  }

  // 查询管理端话题分页。
  async getHashtagPage(query: ForumHashtagAdminPageQuery) {
    const conditions: SQL[] = [isNull(this.forumHashtag.deletedAt)]

    if (query.keyword?.trim()) {
      const keyword = `%${query.keyword.trim()}%`
      conditions.push(
        or(
          ilike(this.forumHashtag.displayName, keyword),
          ilike(this.forumHashtag.slug, keyword),
        )!,
      )
    }
    if (query.auditStatus !== undefined) {
      conditions.push(eq(this.forumHashtag.auditStatus, query.auditStatus))
    }
    if (query.isHidden !== undefined) {
      conditions.push(eq(this.forumHashtag.isHidden, query.isHidden))
    }

    const where = and(...conditions)
    const page = this.drizzle.buildPage(query)
    const orderQuery = this.drizzle.buildOrderBy(
      [{ createdAt: 'desc' as const }],
      { table: this.forumHashtag },
    )
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.forumHashtag)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.forumHashtag, where),
    ])

    return toPageResult(
      list.map((item) => this.toAdminForumHashtagDto(item)),
      total,
      page,
    )
  }

  // 查询管理端话题详情。
  async getHashtagDetail(id: number) {
    const hashtag = await this.db.query.forumHashtag.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
    })

    if (!hashtag) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '话题不存在',
      )
    }

    return this.toAdminForumHashtagDto(hashtag)
  }

  // 查询 app 侧公开话题详情。
  async getPublicHashtagDetail(id: number, userId?: number) {
    const hashtag = await this.db.query.forumHashtag.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        slug: true,
        displayName: true,
        description: true,
        topicRefCount: true,
        commentRefCount: true,
        followerCount: true,
        lastReferencedAt: true,
        auditStatus: true,
        isHidden: true,
        deletedAt: true,
      },
    })

    if (!hashtag || !this.isPublic(hashtag)) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '话题不存在',
      )
    }

    const followedMap = await this.getFollowedMap([id], userId)
    return {
      id: hashtag.id,
      slug: hashtag.slug,
      displayName: hashtag.displayName,
      description: hashtag.description ?? null,
      topicRefCount: hashtag.topicRefCount,
      commentRefCount: hashtag.commentRefCount,
      followerCount: hashtag.followerCount,
      lastReferencedAt: hashtag.lastReferencedAt ?? null,
      isFollowed: followedMap.get(id) ?? false,
    }
  }

  // 查询 app 侧热门话题分页。
  async getHotHashtagPage(query: ForumHashtagHotPageQuery) {
    this.assertPublicCursorPageQuery(query as unknown as Record<string, unknown>)
    const hotScoreSql = this.buildHotScoreSql()
    const page = this.buildCursorPage(query)
    const cursor = this.parseHotHashtagCursor(query.cursor)
    const where = and(
      eq(this.forumHashtag.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.forumHashtag.isHidden, false),
      isNull(this.forumHashtag.deletedAt),
      cursor ? this.buildHotHashtagCursorWhere(cursor, hotScoreSql) : undefined,
    )
    const list = await this.db
        .select({
          id: this.forumHashtag.id,
          slug: this.forumHashtag.slug,
          displayName: this.forumHashtag.displayName,
          description: this.forumHashtag.description,
          topicRefCount: this.forumHashtag.topicRefCount,
          commentRefCount: this.forumHashtag.commentRefCount,
          followerCount: this.forumHashtag.followerCount,
          lastReferencedAt: this.forumHashtag.lastReferencedAt,
          hotScore: hotScoreSql.as('hotScore'),
        })
        .from(this.forumHashtag)
        .where(where)
        .orderBy(
          desc(hotScoreSql),
          desc(sql`coalesce(${this.forumHashtag.lastReferencedAt}, '1970-01-01'::timestamptz)`),
          desc(this.forumHashtag.id),
        )
        .limit(page.limit + 1)
    const pageList = list.slice(0, page.limit)
    const hasMore = list.length > page.limit

    const followedMap = await this.getFollowedMap(
      pageList.map((item) => item.id),
      query.userId,
    )

    return {
      list: pageList.map((item) => ({
        id: item.id,
        slug: item.slug,
        displayName: item.displayName,
        description: item.description ?? null,
        topicRefCount: item.topicRefCount,
        commentRefCount: item.commentRefCount,
        followerCount: item.followerCount,
        lastReferencedAt: item.lastReferencedAt ?? null,
        hotScore: item.hotScore,
        isFollowed: followedMap.get(item.id) ?? false,
      })),
      pageSize: page.pageSize,
      hasMore,
      nextCursor:
        hasMore && pageList.length > 0
          ? this.encodeCursor({
              hotScore: pageList[pageList.length - 1].hotScore,
              lastReferencedAt:
                pageList[pageList.length - 1].lastReferencedAt?.toISOString()
                ?? null,
              id: pageList[pageList.length - 1].id,
            })
          : null,
    }
  }

  // 公开搜索可见话题资源。
  async searchVisibleHashtags(
    keyword: string,
    userId?: number,
    limit = FORUM_HASHTAG_DEFAULT_SEARCH_LIMIT,
  ) {
    const normalizedKeyword = keyword.trim()
    if (!normalizedKeyword) {
      return []
    }

    const likePattern = `%${normalizedKeyword.normalize('NFKC').toLowerCase()}%`
    const rows = await this.db
      .select({
        id: this.forumHashtag.id,
        slug: this.forumHashtag.slug,
        displayName: this.forumHashtag.displayName,
        description: this.forumHashtag.description,
        topicRefCount: this.forumHashtag.topicRefCount,
        commentRefCount: this.forumHashtag.commentRefCount,
        followerCount: this.forumHashtag.followerCount,
        lastReferencedAt: this.forumHashtag.lastReferencedAt,
      })
      .from(this.forumHashtag)
      .where(
        and(
          eq(this.forumHashtag.auditStatus, AuditStatusEnum.APPROVED),
          eq(this.forumHashtag.isHidden, false),
          isNull(this.forumHashtag.deletedAt),
          or(
            ilike(sql`lower(${this.forumHashtag.slug})`, likePattern),
            ilike(sql`lower(${this.forumHashtag.displayName})`, likePattern),
          ),
        ),
      )
      .orderBy(
        desc(this.forumHashtag.followerCount),
        desc(this.forumHashtag.lastReferencedAt),
      )
      .limit(limit)

    const followedMap = await this.getFollowedMap(
      rows.map((item) => item.id),
      userId,
    )

    return rows.map((item) => ({
      ...item,
      description: item.description ?? null,
      lastReferencedAt: item.lastReferencedAt ?? null,
      isFollowed: followedMap.get(item.id) ?? false,
    }))
  }

  // 查询话题关联的公开主题分页。
  async getHashtagTopicPage(
    hashtagId: number,
    query: ForumHashtagLinkedContentPageQuery,
  ) {
    this.assertPublicCursorPageQuery(query as unknown as Record<string, unknown>)
    await this.getPublicHashtagDetail(hashtagId, query.userId)
    const visibleSectionIds =
      await this.forumPermissionService.getAccessibleSectionIds(query.userId)
    if (visibleSectionIds.length === 0) {
      return {
        list: [],
        pageSize: query.pageSize,
        hasMore: false,
        nextCursor: null,
      }
    }

    const page = this.buildCursorPage(query)
    const cursor = this.parseDateIdCursor(query.cursor)
    const where = and(
      eq(this.forumHashtagReference.hashtagId, hashtagId),
      eq(
        this.forumHashtagReference.sourceType,
        ForumHashtagReferenceSourceTypeEnum.TOPIC,
      ),
      eq(this.forumHashtagReference.isSourceVisible, true),
      inArray(this.forumHashtagReference.sectionId, visibleSectionIds),
      cursor ? this.buildDateIdDescCursorWhere(cursor) : undefined,
    )

    const referenceRows = await this.db
        .select({
          id: this.forumHashtagReference.id,
          topicId: this.forumHashtagReference.topicId,
          referencedAt: this.forumHashtagReference.createdAt,
        })
        .from(this.forumHashtagReference)
        .where(where)
        .orderBy(
          desc(this.forumHashtagReference.createdAt),
          desc(this.forumHashtagReference.id),
        )
        .limit(page.limit + 1)
    const pageReferenceRows = referenceRows.slice(0, page.limit)
    const hasMore = referenceRows.length > page.limit

    const topicIds = [...new Set(pageReferenceRows.map((item) => item.topicId))]
    if (topicIds.length === 0) {
      return {
        list: [],
        pageSize: page.pageSize,
        hasMore,
        nextCursor: null,
      }
    }

    const topics = await this.db
      .select({
        id: this.forumTopic.id,
        sectionId: this.forumTopic.sectionId,
        userId: this.forumTopic.userId,
        title: this.forumTopic.title,
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
        contentPreview: this.forumTopic.contentPreview,
      })
      .from(this.forumTopic)
      .where(
        and(
          inArray(this.forumTopic.id, topicIds),
          eq(this.forumTopic.auditStatus, AuditStatusEnum.APPROVED),
          eq(this.forumTopic.isHidden, false),
          isNull(this.forumTopic.deletedAt),
        ),
      )

    const [sectionMap, userMap, likedMap, favoritedMap] = await Promise.all([
      this.getTopicSectionBriefMap(topics.map((item) => item.sectionId)),
      this.getTopicUserBriefMap(topics.map((item) => item.userId)),
      query.userId
        ? this.likeService.checkStatusBatch(
            LikeTargetTypeEnum.FORUM_TOPIC,
            topicIds,
            query.userId,
          )
        : Promise.resolve(new Map<number, boolean>()),
      query.userId
        ? this.favoriteService.checkStatusBatch(
            FavoriteTargetTypeEnum.FORUM_TOPIC,
            topicIds,
            query.userId,
          )
        : Promise.resolve(new Map<number, boolean>()),
    ])

    const topicMap = new Map(topics.map((topic) => [topic.id, topic] as const))

    return {
      list: pageReferenceRows
        .map((reference) => {
          const topic = topicMap.get(reference.topicId)
          if (!topic) {
            return null
          }

          const section = sectionMap.get(topic.sectionId)
          const user = userMap.get(topic.userId)
          if (!section || !user) {
            return null
          }

          return {
            ...topic,
            geoCountry: topic.geoCountry ?? null,
            geoProvince: topic.geoProvince ?? null,
            geoCity: topic.geoCity ?? null,
            geoIsp: topic.geoIsp ?? null,
            lastCommentAt: topic.lastCommentAt ?? null,
            liked: likedMap.get(topic.id) ?? false,
            favorited: favoritedMap.get(topic.id) ?? false,
            user,
            section,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
      pageSize: page.pageSize,
      hasMore,
      nextCursor:
        hasMore && pageReferenceRows.length > 0
          ? this.encodeCursor({
              createdAt:
                pageReferenceRows[
                  pageReferenceRows.length - 1
                ].referencedAt.toISOString(),
              id: pageReferenceRows[pageReferenceRows.length - 1].id,
            })
          : null,
    }
  }

  // 查询话题关联的公开评论分页。
  async getHashtagCommentPage(
    hashtagId: number,
    query: ForumHashtagLinkedContentPageQuery,
  ) {
    this.assertPublicCursorPageQuery(query as unknown as Record<string, unknown>)
    await this.getPublicHashtagDetail(hashtagId, query.userId)
    const visibleSectionIds =
      await this.forumPermissionService.getAccessibleSectionIds(query.userId)
    if (visibleSectionIds.length === 0) {
      return {
        list: [],
        pageSize: query.pageSize,
        hasMore: false,
        nextCursor: null,
      }
    }

    const page = this.buildCursorPage(query)
    const cursor = this.parseDateIdCursor(query.cursor)
    const where = and(
      eq(this.forumHashtagReference.hashtagId, hashtagId),
      eq(
        this.forumHashtagReference.sourceType,
        ForumHashtagReferenceSourceTypeEnum.COMMENT,
      ),
      eq(this.forumHashtagReference.isSourceVisible, true),
      inArray(this.forumHashtagReference.sectionId, visibleSectionIds),
      cursor ? this.buildDateIdDescCursorWhere(cursor) : undefined,
    )

    const rows = await this.db
        .select({
          id: this.forumHashtagReference.id,
          commentId: this.userComment.id,
          topicId: this.forumTopic.id,
          topicTitle: this.forumTopic.title,
          userId: this.userComment.userId,
          html: this.userComment.html,
          likeCount: this.userComment.likeCount,
          createdAt: this.userComment.createdAt,
          referencedAt: this.forumHashtagReference.createdAt,
        })
        .from(this.forumHashtagReference)
        .innerJoin(
          this.userComment,
          eq(this.forumHashtagReference.sourceId, this.userComment.id),
        )
        .innerJoin(
          this.forumTopic,
          eq(this.userComment.targetId, this.forumTopic.id),
        )
        .where(where)
        .orderBy(
          desc(this.forumHashtagReference.createdAt),
          desc(this.forumHashtagReference.id),
        )
        .limit(page.limit + 1)
    const pageRows = rows.slice(0, page.limit)
    const hasMore = rows.length > page.limit

    const userMap = await this.getTopicUserBriefMap(
      pageRows.map((item) => item.userId),
    )

    return {
      list: pageRows.map((item) => {
        const user = userMap.get(item.userId)
        if (!user) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '话题评论用户数据缺失',
          )
        }
        return {
          commentId: item.commentId,
          topicId: item.topicId,
          topicTitle: item.topicTitle,
          userId: item.userId,
          html: item.html,
          likeCount: item.likeCount,
          createdAt: item.createdAt,
          user: {
            id: user.id,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl ?? null,
          },
        }
      }),
      pageSize: page.pageSize,
      hasMore,
      nextCursor:
        hasMore && pageRows.length > 0
          ? this.encodeCursor({
              createdAt: pageRows[pageRows.length - 1].referencedAt.toISOString(),
              id: pageRows[pageRows.length - 1].id,
            })
          : null,
    }
  }
}
