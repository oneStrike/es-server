import type {
  ForumHashtagSelect,
} from '@db/schema'
import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/core'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { FavoriteService } from '@libs/interaction/favorite/favorite.service'
import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { FollowService } from '@libs/interaction/follow/follow.service'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { LikeService } from '@libs/interaction/like/like.service'
import {
  AuditRoleEnum,
  AuditStatusEnum,
  BusinessErrorCode,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
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
  private isPublic(
    hashtag: Pick<ForumHashtagSelect, 'auditStatus' | 'isHidden' | 'deletedAt'>,
  ) {
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
  async createHashtag(
    input: {
      displayName: string
      description?: string
      manualBoost?: number
    },
    adminUserId: number,
  ) {
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
  async updateHashtag(input: {
    id: number
    description?: string | null
    manualBoost?: number
  }) {
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
  async updateHashtagHidden(input: { id: number, isHidden: boolean }) {
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
    input: { id: number, auditStatus: AuditStatusEnum, auditReason?: string },
    options?: { auditById?: number, auditRole?: AuditRoleEnum },
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
  async getHashtagPage(query: {
    pageIndex: number
    pageSize: number
    keyword?: string
    auditStatus?: AuditStatusEnum
    isHidden?: boolean
  }) {
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

    return this.drizzle.ext.findPagination(this.forumHashtag, {
      where: and(...conditions),
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: [{ createdAt: 'desc' as const }],
    })
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

    return hashtag
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
      description: hashtag.description,
      topicRefCount: hashtag.topicRefCount,
      commentRefCount: hashtag.commentRefCount,
      followerCount: hashtag.followerCount,
      lastReferencedAt: hashtag.lastReferencedAt,
      isFollowed: followedMap.get(id) ?? false,
    }
  }

  // 查询 app 侧热门话题分页。
  async getHotHashtagPage(query: {
    pageIndex: number
    pageSize: number
    userId?: number
  }) {
    const hotScoreSql = this.buildHotScoreSql()
    const page = this.drizzle.buildPage(query)
    const [list, total] = await Promise.all([
      this.db
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
        .where(
          and(
            eq(this.forumHashtag.auditStatus, AuditStatusEnum.APPROVED),
            eq(this.forumHashtag.isHidden, false),
            isNull(this.forumHashtag.deletedAt),
          ),
        )
        .orderBy(
          desc(hotScoreSql),
          desc(this.forumHashtag.lastReferencedAt),
          desc(this.forumHashtag.id),
        )
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(
        this.forumHashtag,
        and(
          eq(this.forumHashtag.auditStatus, AuditStatusEnum.APPROVED),
          eq(this.forumHashtag.isHidden, false),
          isNull(this.forumHashtag.deletedAt),
        ),
      ),
    ])

    const followedMap = await this.getFollowedMap(
      list.map((item) => item.id),
      query.userId,
    )

    return {
      list: list.map((item) => ({
        id: item.id,
        slug: item.slug,
        displayName: item.displayName,
        description: item.description,
        topicRefCount: item.topicRefCount,
        commentRefCount: item.commentRefCount,
        followerCount: item.followerCount,
        lastReferencedAt: item.lastReferencedAt,
        hotScore: item.hotScore,
        isFollowed: followedMap.get(item.id) ?? false,
      })),
      total,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
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
      isFollowed: followedMap.get(item.id) ?? false,
    }))
  }

  // 查询话题关联的公开主题分页。
  async getHashtagTopicPage(
    hashtagId: number,
    query: {
      pageIndex: number
      pageSize: number
      userId?: number
    },
  ) {
    await this.getPublicHashtagDetail(hashtagId, query.userId)
    const visibleSectionIds =
      await this.forumPermissionService.getAccessibleSectionIds(query.userId)
    if (visibleSectionIds.length === 0) {
      return {
        list: [],
        total: 0,
        pageIndex: query.pageIndex,
        pageSize: query.pageSize,
      }
    }

    const page = this.drizzle.buildPage(query)
    const where = and(
      eq(this.forumHashtagReference.hashtagId, hashtagId),
      eq(
        this.forumHashtagReference.sourceType,
        ForumHashtagReferenceSourceTypeEnum.TOPIC,
      ),
      eq(this.forumHashtagReference.isSourceVisible, true),
      inArray(this.forumHashtagReference.sectionId, visibleSectionIds),
    )

    const [referenceRows, total] = await Promise.all([
      this.db
        .select({
          topicId: this.forumHashtagReference.topicId,
          referencedAt: this.forumHashtagReference.createdAt,
        })
        .from(this.forumHashtagReference)
        .where(where)
        .orderBy(
          desc(this.forumHashtagReference.createdAt),
          desc(this.forumHashtagReference.id),
        )
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.forumHashtagReference, where),
    ])

    const topicIds = [...new Set(referenceRows.map((item) => item.topicId))]
    if (topicIds.length === 0) {
      return {
        list: [],
        total,
        pageIndex: page.pageIndex,
        pageSize: page.pageSize,
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
        contentSnippet: sql<string>`left(trim(${this.forumTopic.content}), 60)`,
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
      list: referenceRows
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
            geoCountry: topic.geoCountry ?? undefined,
            geoProvince: topic.geoProvince ?? undefined,
            geoCity: topic.geoCity ?? undefined,
            geoIsp: topic.geoIsp ?? undefined,
            liked: likedMap.get(topic.id) ?? false,
            favorited: favoritedMap.get(topic.id) ?? false,
            user,
            section,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
      total,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  // 查询话题关联的公开评论分页。
  async getHashtagCommentPage(
    hashtagId: number,
    query: {
      pageIndex: number
      pageSize: number
      userId?: number
    },
  ) {
    await this.getPublicHashtagDetail(hashtagId, query.userId)
    const visibleSectionIds =
      await this.forumPermissionService.getAccessibleSectionIds(query.userId)
    if (visibleSectionIds.length === 0) {
      return {
        list: [],
        total: 0,
        pageIndex: query.pageIndex,
        pageSize: query.pageSize,
      }
    }

    const page = this.drizzle.buildPage(query)
    const where = and(
      eq(this.forumHashtagReference.hashtagId, hashtagId),
      eq(
        this.forumHashtagReference.sourceType,
        ForumHashtagReferenceSourceTypeEnum.COMMENT,
      ),
      eq(this.forumHashtagReference.isSourceVisible, true),
      inArray(this.forumHashtagReference.sectionId, visibleSectionIds),
    )

    const [rows, total] = await Promise.all([
      this.db
        .select({
          commentId: this.userComment.id,
          topicId: this.forumTopic.id,
          topicTitle: this.forumTopic.title,
          userId: this.userComment.userId,
          body: this.userComment.body,
          content: this.userComment.content,
          bodyTokens: this.userComment.bodyTokens,
          likeCount: this.userComment.likeCount,
          createdAt: this.userComment.createdAt,
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
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.forumHashtagReference, where),
    ])

    const userMap = await this.getTopicUserBriefMap(
      rows.map((item) => item.userId),
    )

    return {
      list: rows.map((item) => ({
        ...item,
        body: item.body,
        bodyTokens: item.bodyTokens,
        user: userMap.get(item.userId),
      })),
      total,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }
}
