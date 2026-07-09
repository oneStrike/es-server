import type { DbQueryOrderByRecord } from '@libs/platform/config'

import type { JsonValue } from '@libs/platform/utils'
import type { SensitiveWordHitDto } from '@libs/sensitive-word/dto/sensitive-word.dto'
import type { SQL } from 'drizzle-orm'
import type {
  FollowingPublicForumTopicQuery,
  HydratePublicTopicPageOptions,
  PublicForumTopicDetailContext,
  PublicForumTopicQueryWithUser,
  PublicTopicInteractionSnapshot,
  PublicTopicPageRow,
  TopicSectionBrief,
  VisiblePublicTopicDetailRow,
} from './forum-topic.type'
import { buildLikePattern, DrizzleService, toPageResult } from '@db/core'
import { GrowthBalanceQueryService } from '@libs/growth/growth-ledger/growth-balance-query.service'
import { BodyCompilerService } from '@libs/interaction/body/body-compiler.service'
import { BodyHtmlCodecService } from '@libs/interaction/body/body-html-codec.service'
import { BrowseLogTargetTypeEnum } from '@libs/interaction/browse-log/browse-log.constant'
import { BrowseLogService } from '@libs/interaction/browse-log/browse-log.service'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { FavoriteService } from '@libs/interaction/favorite/favorite.service'
import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { FollowService } from '@libs/interaction/follow/follow.service'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { LikeService } from '@libs/interaction/like/like.service'
import { MentionService } from '@libs/interaction/mention/mention.service'
import { InteractionSummaryReadService } from '@libs/interaction/summary/interaction-summary-read.service'
import { AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import { Injectable } from '@nestjs/common'
import {
  and,
  eq,
  exists,
  getColumns,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
} from 'drizzle-orm'
import { ForumCounterService } from '../counter/forum-counter.service'
import { ForumHashtagBodyService } from '../hashtag/forum-hashtag-body.service'
import { ForumHashtagReferenceService } from '../hashtag/forum-hashtag-reference.service'
import { ForumHashtagReferenceSourceTypeEnum } from '../hashtag/forum-hashtag.constant'
import { ForumPermissionService } from '../permission/forum-permission.service'
import {
  AdminForumTopicDetailDto,
  ForumTopicDeletedStateEnum,
  PublicForumTopicDetailDto,
  QueryForumTopicDto,
} from './dto/forum-topic.dto'
import { ForumTopicServiceSupport } from './forum-topic.service.support'

const DEFAULT_PUBLIC_TOPIC_FEED_ORDER: DbQueryOrderByRecord[] = [
  { isPinned: 'desc' as const },
  { lastCommentAt: 'desc' as const },
  { createdAt: 'desc' as const },
  { id: 'desc' as const },
]

const HOT_PUBLIC_TOPIC_FEED_ORDER: DbQueryOrderByRecord[] = [
  { commentCount: 'desc' as const },
  { likeCount: 'desc' as const },
  { viewCount: 'desc' as const },
  { createdAt: 'desc' as const },
  { id: 'desc' as const },
]

const DEFAULT_ADMIN_TOPIC_PAGE_ORDER: DbQueryOrderByRecord[] = [
  { updatedAt: 'desc' as const },
  { id: 'desc' as const },
]

// 论坛主题查询服务。
// 负责公开分页、后台分页、详情聚合等读模型，
// 避免 facade 承担 Drizzle 查询拼装和跨域摘要组装。
@Injectable()
export class ForumTopicQueryService extends ForumTopicServiceSupport {
  constructor(
    drizzle: DrizzleService,
    forumPermissionService: ForumPermissionService,
    forumCounterService: ForumCounterService,
    forumHashtagReferenceService: ForumHashtagReferenceService,
    mentionService: MentionService,
    bodyCompilerService: BodyCompilerService,
    bodyHtmlCodecService: BodyHtmlCodecService,
    sensitiveWordDetectService: SensitiveWordDetectService,
    forumHashtagBodyService: ForumHashtagBodyService,
    interactionSummaryReadService: InteractionSummaryReadService,
    growthBalanceQueryService: GrowthBalanceQueryService,
    private readonly browseLogService: BrowseLogService,
    private readonly likeService: LikeService,
    private readonly favoriteService: FavoriteService,
    private readonly followService: FollowService,
  ) {
    super(
      drizzle,
      forumPermissionService,
      forumCounterService,
      forumHashtagReferenceService,
      mentionService,
      bodyCompilerService,
      bodyHtmlCodecService,
      sensitiveWordDetectService,
      forumHashtagBodyService,
      interactionSummaryReadService,
      growthBalanceQueryService,
    )
  }

  // ─── 公开分页内部方法 ──────────────────────────────────────

  // 构建公开主题分页的 select 投影，复用统一字段列表。
  // 排除：正文大字段(html/content/body/bodyVersion)、审核管理字段(auditById/auditStatus/auditRole/auditReason/auditAt/isHidden)、
  // 内部控制字段(version/sensitiveWordHits/geoSource/lastCommentUserId/updatedAt/deletedAt)
  private buildPublicTopicPageSelect() {
    const {
      html,
      content,
      body,
      bodyVersion,
      auditById,
      auditStatus,
      auditRole,
      auditReason,
      auditAt,
      isHidden,
      version,
      sensitiveWordHits,
      geoSource,
      lastCommentUserId,
      updatedAt,
      deletedAt,
      ...rest
    } = getColumns(this.forumTopicTable)
    return rest
  }

  // 解析公开主题分页的可用板块 ID 列表；传入 sectionId 时校验单板块权限，否则取全部可访问板块。
  private async resolvePublicTopicSectionIds(
    sectionId: number | undefined,
    userId?: number,
  ) {
    if (sectionId !== undefined) {
      await this.forumPermissionService.ensureUserCanAccessSection(
        sectionId,
        userId,
        {
          requireEnabled: true,
        },
      )

      return [sectionId]
    }

    return this.forumPermissionService.getAccessibleSectionIds(userId)
  }

  // 构建关注用户发帖的存在性条件，避免先物化关注用户 ID。
  private buildFollowedUserTopicExistsCondition(userId: number) {
    return exists(
      this.db
        .select({ id: this.userFollowTable.id })
        .from(this.userFollowTable)
        .where(
          and(
            eq(this.userFollowTable.userId, userId),
            eq(this.userFollowTable.targetType, FollowTargetTypeEnum.USER),
            eq(this.userFollowTable.targetId, this.forumTopicTable.userId),
          ),
        ),
    )
  }

  // 构建关注板块主题的存在性条件，section 可见性仍由主查询的 sectionIds 约束保证。
  private buildFollowedSectionTopicExistsCondition(userId: number) {
    return exists(
      this.db
        .select({ id: this.userFollowTable.id })
        .from(this.userFollowTable)
        .where(
          and(
            eq(this.userFollowTable.userId, userId),
            eq(
              this.userFollowTable.targetType,
              FollowTargetTypeEnum.FORUM_SECTION,
            ),
            eq(this.userFollowTable.targetId, this.forumTopicTable.sectionId),
          ),
        ),
    )
  }

  // 构建关注 hashtag feed 的存在性条件；把 hashtag 过滤留在分页查询内，避免先物化关注 hashtag 或未分页 topicId 大数组。
  private buildFollowedHashtagTopicExistsCondition(userId: number) {
    return exists(
      this.db
        .select({ id: this.forumHashtagReferenceTable.id })
        .from(this.forumHashtagReferenceTable)
        .where(
          and(
            eq(
              this.forumHashtagReferenceTable.topicId,
              this.forumTopicTable.id,
            ),
            eq(
              this.forumHashtagReferenceTable.sourceType,
              ForumHashtagReferenceSourceTypeEnum.TOPIC,
            ),
            eq(this.forumHashtagReferenceTable.isSourceVisible, true),
            exists(
              this.db
                .select({ id: this.userFollowTable.id })
                .from(this.userFollowTable)
                .where(
                  and(
                    eq(this.userFollowTable.userId, userId),
                    eq(
                      this.userFollowTable.targetType,
                      FollowTargetTypeEnum.FORUM_HASHTAG,
                    ),
                    eq(
                      this.userFollowTable.targetId,
                      this.forumHashtagReferenceTable.hashtagId,
                    ),
                  ),
                ),
            ),
          ),
        ),
    )
  }

  // 为公开主题分页条目补齐用户简要信息、板块简要信息与当前用户的点赞/收藏状态。
  private async hydratePublicTopicPageItems(
    rows: PublicTopicPageRow[],
    options: HydratePublicTopicPageOptions,
  ) {
    if (rows.length === 0) {
      return []
    }

    const topicIds = rows.map((item) => item.id)
    const userIds = rows.map((item) => item.userId)
    const [singleSection, sectionMap, userMap, likedMap, favoritedMap] =
      await Promise.all([
        options.sectionId !== undefined
          ? this.getTopicSectionBrief(options.sectionId)
          : Promise.resolve(null),
        options.sectionId === undefined
          ? this.getTopicSectionBriefMap(
              rows.map((item) => item.sectionId),
              { requireEnabled: true },
            )
          : Promise.resolve(new Map<number, TopicSectionBrief>()),
        this.getTopicUserBriefMap(userIds),
        options.userId
          ? this.likeService.checkStatusBatch(
              LikeTargetTypeEnum.FORUM_TOPIC,
              topicIds,
              options.userId,
            )
          : Promise.resolve(new Map<number, boolean>()),
        options.userId
          ? this.favoriteService.checkStatusBatch(
              FavoriteTargetTypeEnum.FORUM_TOPIC,
              topicIds,
              options.userId,
            )
          : Promise.resolve(new Map<number, boolean>()),
      ])

    return rows
      .map((item) => {
        const section =
          options.sectionId !== undefined
            ? singleSection
            : sectionMap.get(item.sectionId)

        if (!section) {
          return null
        }
        const user = userMap.get(item.userId)
        if (!user) {
          return null
        }

        return {
          ...item,
          liked: likedMap.get(item.id) ?? false,
          favorited: favoritedMap.get(item.id) ?? false,
          user,
          section,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }

  // 按条件查询公开主题分页；统一封装筛选、排序、计数与条目组装逻辑。
  private async getPublicTopicPageByConditions(
    query: PublicForumTopicQueryWithUser,
    sectionIds: number[],
    fallbackOrderBy: DbQueryOrderByRecord[],
    extraCondition?: SQL,
  ) {
    const pageParams = this.drizzle.buildPageParams(query, {
      allowlistedOrderBy: {
        columns: this.getPublicTopicOrderColumns(),
        fallbackOrderBy,
      },
    })

    if (sectionIds.length === 0) {
      return toPageResult([], 0, pageParams.page)
    }

    const conditions: SQL[] = [
      inArray(this.forumTopicTable.sectionId, [...new Set(sectionIds)]),
      isNull(this.forumTopicTable.deletedAt),
      eq(this.forumTopicTable.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.forumTopicTable.isHidden, false),
    ]
    if (extraCondition) {
      conditions.push(extraCondition)
    }
    if (pageParams.dateRange?.gte) {
      conditions.push(
        gte(this.forumTopicTable.createdAt, pageParams.dateRange.gte),
      )
    }
    if (pageParams.dateRange?.lt) {
      conditions.push(
        lt(this.forumTopicTable.createdAt, pageParams.dateRange.lt),
      )
    }

    const where = and(...conditions)
    const listQuery = this.db
      .select(this.buildPublicTopicPageSelect())
      .from(this.forumTopicTable)
      .where(where)
      .limit(pageParams.page.limit)
      .offset(pageParams.page.offset)

    const [list, total] = await Promise.all([
      listQuery.orderBy(...pageParams.order.orderBySql),
      this.db.$count(this.forumTopicTable, where),
    ])
    const page = toPageResult(
      list as PublicTopicPageRow[],
      total,
      pageParams.page,
    )

    return {
      ...page,
      list: await this.hydratePublicTopicPageItems(page.list, {
        userId: query.userId,
        sectionId: query.sectionId,
      }),
    }
  }

  private getPublicTopicOrderColumns() {
    return {
      isPinned: this.forumTopicTable.isPinned,
      lastCommentAt: this.forumTopicTable.lastCommentAt,
      createdAt: this.forumTopicTable.createdAt,
      id: this.forumTopicTable.id,
      commentCount: this.forumTopicTable.commentCount,
      likeCount: this.forumTopicTable.likeCount,
      viewCount: this.forumTopicTable.viewCount,
    }
  }

  // 后台主题分页允许排序的字段白名单，避免暴露整表列排序能力。
  private getAdminTopicOrderColumns() {
    return {
      id: this.forumTopicTable.id,
      createdAt: this.forumTopicTable.createdAt,
      likeCount: this.forumTopicTable.likeCount,
      commentCount: this.forumTopicTable.commentCount,
    }
  }

  // ─── 公开详情内部方法 ──────────────────────────────────────

  // 获取对公开访问可见的主题详情；只返回已审核通过且未隐藏的主题，同时校验板块访问权限。
  private async getVisiblePublicTopic(id: number, userId?: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
      },
      with: {
        section: {
          columns: {
            id: true,
            groupId: true,
            deletedAt: true,
            isEnabled: true,
            name: true,
            cover: true,
            topicCount: true,
            followersCount: true,
          },
          with: {
            group: {
              columns: {
                isEnabled: true,
                deletedAt: true,
              },
            },
          },
        },
        user: {
          columns: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
    })

    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    await this.forumPermissionService.ensureUserCanAccessSection(
      topic.sectionId,
      userId,
      {
        requireEnabled: true,
        notFoundMessage: '主题不存在',
      },
    )

    if (!topic.user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题作者不存在',
      )
    }
    if (!topic.section) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    return topic
  }

  // 构建公开主题详情响应；显式裁剪 app/public 可见字段，避免把审核、治理等后台字段直接透传到外部契约。
  private async buildPublicTopicDetail(
    topic: VisiblePublicTopicDetailRow,
    interaction: PublicTopicInteractionSnapshot,
  ): Promise<PublicForumTopicDetailDto> {
    if (!topic.user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题作者不存在',
      )
    }
    if (!topic.section) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    // 排除不应透传到公开 DTO 的字段：正文派生列(content/contentPreview/body/bodyVersion)、审核管理字段、
    // 内部控制字段(version/sensitiveWordHits/geoSource/lastCommentUserId/deletedAt)、关系查询的关联对象需重新构造
    const {
      content,
      contentPreview,
      body,
      bodyVersion,
      auditById,
      auditStatus,
      auditRole,
      auditReason,
      auditAt,
      isHidden,
      version,
      sensitiveWordHits,
      geoSource,
      lastCommentUserId,
      viewCount,
      videos,
      deletedAt,
      section: _section,
      user: _user,
      ...topicFields
    } = topic

    return {
      ...topicFields,
      videos: videos as JsonValue,
      viewCount: interaction.viewCount,
      liked: interaction.liked,
      favorited: interaction.favorited,
      user: {
        id: topic.user.id,
        nickname: topic.user.nickname,
        avatarUrl: topic.user.avatarUrl,
        isFollowed: interaction.isFollowed,
      },
      section: {
        id: topic.section.id,
        name: topic.section.name,
        cover: topic.section.cover,
        topicCount: topic.section.topicCount,
        followersCount: topic.section.followersCount,
      },
      hashtags: await this.getTopicHashtags(topic.id),
    }
  }

  // ─── 公开方法 ──────────────────────────────────────────────

  // 获取公开主题分页列表；只返回已审核通过且未隐藏的主题，登录用户返回点赞与收藏状态。
  async getPublicTopics(query: PublicForumTopicQueryWithUser) {
    const sectionIds = await this.resolvePublicTopicSectionIds(
      query.sectionId,
      query.userId,
    )

    return this.getPublicTopicPageByConditions(
      query,
      sectionIds,
      DEFAULT_PUBLIC_TOPIC_FEED_ORDER,
    )
  }

  // 获取公开主题热门分页列表；基于可访问板块聚合，排序规则为评论数、点赞数、浏览数、发布时间倒序。
  async getHotPublicTopics(query: PublicForumTopicQueryWithUser) {
    const sectionIds = await this.resolvePublicTopicSectionIds(
      query.sectionId,
      query.userId,
    )

    return this.getPublicTopicPageByConditions(
      query,
      sectionIds,
      HOT_PUBLIC_TOPIC_FEED_ORDER,
    )
  }

  // 获取关注主题分页列表；聚合"关注用户发帖"与"关注板块下主题"两类来源，仅返回当前用户仍可访问板块下的公开主题。
  async getFollowingPublicTopics(query: FollowingPublicForumTopicQuery) {
    const sectionIds = await this.resolvePublicTopicSectionIds(
      query.sectionId,
      query.userId,
    )
    if (sectionIds.length === 0) {
      return this.getPublicTopicPageByConditions(
        query,
        [],
        DEFAULT_PUBLIC_TOPIC_FEED_ORDER,
      )
    }

    const followConditions: SQL[] = [
      this.buildFollowedUserTopicExistsCondition(query.userId),
      this.buildFollowedSectionTopicExistsCondition(query.userId),
      this.buildFollowedHashtagTopicExistsCondition(query.userId),
    ]

    return this.getPublicTopicPageByConditions(
      query,
      sectionIds,
      DEFAULT_PUBLIC_TOPIC_FEED_ORDER,
      or(...followConditions),
    )
  }

  // 获取公开主题详情，包含当前用户的点赞、收藏与关注发帖用户状态；匿名用户返回固定状态保持响应结构稳定。
  async getPublicTopicById(
    id: number,
    context: PublicForumTopicDetailContext = {},
  ): Promise<PublicForumTopicDetailDto> {
    const { userId, ipAddress, device } = context
    const topic = await this.getVisiblePublicTopic(id, userId)

    if (!userId) {
      return this.buildPublicTopicDetail(topic, {
        liked: false,
        favorited: false,
        isFollowed: false,
        viewCount: topic.viewCount,
      })
    }

    const [liked, favorited, isFollowed] = await Promise.all([
      this.likeService.checkLikeStatus({
        targetType: LikeTargetTypeEnum.FORUM_TOPIC,
        targetId: id,
        userId,
      }),
      this.favoriteService.checkFavoriteStatus({
        targetType: FavoriteTargetTypeEnum.FORUM_TOPIC,
        targetId: id,
        userId,
      }),
      userId === topic.userId
        ? Promise.resolve(false)
        : this.followService
            .checkFollowStatus({
              targetType: FollowTargetTypeEnum.USER,
              targetId: topic.userId,
              userId,
            })
            .then((result) => result.isFollowing),
    ])

    await this.browseLogService.recordBrowseLogSafely(
      BrowseLogTargetTypeEnum.FORUM_TOPIC,
      id,
      userId,
      ipAddress,
      device,
      undefined,
      {
        skipTargetValidation: true,
        deferPostProcess: true,
      },
    )

    return this.buildPublicTopicDetail(topic, {
      liked,
      favorited,
      isFollowed,
      viewCount: topic.viewCount,
    })
  }

  // 获取主题的评论目标信息，用于评论服务定位评论对象；会先校验主题是否对当前用户可见。
  async getTopicCommentTarget(id: number, userId?: number) {
    await this.getVisiblePublicTopic(id, userId)
    return {
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: id,
    }
  }

  // 批量获取收藏列表所需的公开主题分页项详情；复用主题分页的字段语义，并补充当前用户的点赞/收藏状态与发帖用户简要信息。
  async batchGetFavoriteTopicDetails(targetIds: number[], userId?: number) {
    if (targetIds.length === 0) {
      return new Map<number, unknown>()
    }

    const topics = await this.db
      .select(this.buildPublicTopicPageSelect())
      .from(this.forumTopicTable)
      .where(
        and(
          inArray(this.forumTopicTable.id, [...new Set(targetIds)]),
          eq(this.forumTopicTable.auditStatus, AuditStatusEnum.APPROVED),
          eq(this.forumTopicTable.isHidden, false),
          isNull(this.forumTopicTable.deletedAt),
        ),
      )

    const sectionIds = topics.map((topic) => topic.sectionId)
    const userIds = topics.map((topic) => topic.userId)
    const [sectionMap, userMap] = await Promise.all([
      this.getTopicSectionBriefMap(sectionIds, {
        requireEnabled: true,
      }),
      this.getTopicUserBriefMap(userIds),
    ])
    const visibleTopics = topics.filter((topic) =>
      sectionMap.has(topic.sectionId),
    )

    if (visibleTopics.length === 0) {
      return new Map()
    }

    let likedMap = new Map<number, boolean>()
    let favoritedMap = new Map<number, boolean>()
    if (userId) {
      const visibleTopicIds = visibleTopics.map((topic) => topic.id)
      ;[likedMap, favoritedMap] = await Promise.all([
        this.likeService.checkStatusBatch(
          LikeTargetTypeEnum.FORUM_TOPIC,
          visibleTopicIds,
          userId,
        ),
        this.favoriteService.checkStatusBatch(
          FavoriteTargetTypeEnum.FORUM_TOPIC,
          visibleTopicIds,
          userId,
        ),
      ])
    }

    return new Map(
      visibleTopics
        .map((topic) => {
          const section = sectionMap.get(topic.sectionId)
          const user = userMap.get(topic.userId)
          if (!section || !user) {
            return null
          }

          return [
            topic.id,
            {
              ...topic,
              liked: likedMap.get(topic.id) ?? false,
              favorited: favoritedMap.get(topic.id) ?? false,
              section,
              user,
            },
          ] as const
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    )
  }

  // 将主题视频 JSON 归一为 DTO 所需的稳定 JSON 值。
  private normalizeTopicVideoOutput(value: unknown): JsonValue {
    return this.isJsonValue(value) ? value : []
  }

  // 将敏感词命中 JSON 归一为后台 DTO 的 nullable 输出字段。
  private normalizeSensitiveWordHitOutput(
    value: unknown,
  ): SensitiveWordHitDto[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    return value
      .map((item) => this.normalizeSensitiveWordHitItem(item))
      .filter((item): item is SensitiveWordHitDto => item !== null)
  }

  // 校验并复制单条敏感词命中，避免将未知 JSON 原样透传到输出 DTO。
  private normalizeSensitiveWordHitItem(
    value: unknown,
  ): SensitiveWordHitDto | null {
    if (!this.isJsonObject(value)) {
      return null
    }

    const { word, level, type, replaceWord, start, end, field } = value
    if (
      typeof word !== 'string' ||
      typeof level !== 'number' ||
      typeof type !== 'number' ||
      typeof start !== 'number' ||
      typeof end !== 'number'
    ) {
      return null
    }

    return {
      word,
      level,
      type,
      start,
      end,
      replaceWord:
        typeof replaceWord === 'string' || replaceWord === null
          ? replaceWord
          : null,
      field: typeof field === 'string' && field.length > 0 ? field : 'content',
    }
  }

  // 判断值是否可作为 JSON 输出字段安全返回。
  private isJsonValue(value: unknown): value is JsonValue {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return true
    }
    if (Array.isArray(value)) {
      return value.every((item) => this.isJsonValue(item))
    }

    return (
      this.isJsonObject(value) &&
      Object.values(value).every((item) => this.isJsonValue(item))
    )
  }

  // 判断值是否为普通 JSON object，排除数组和 null。
  private isJsonObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  // ─── 后台查询 ──────────────────────────────────────────────

  // 获取后台主题详情，包含发帖用户、板块、审核人与成长信息。
  async getTopicById(id: number): Promise<AdminForumTopicDetailDto> {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id,
      },
      with: {
        section: {
          columns: {
            id: true,
            name: true,
            description: true,
            icon: true,
            cover: true,
            isEnabled: true,
            topicReviewPolicy: true,
          },
        },
        user: {
          columns: {
            id: true,
            nickname: true,
            avatarUrl: true,
            signature: true,
            bio: true,
            isEnabled: true,
            levelId: true,
            status: true,
            banReason: true,
            banUntil: true,
          },
          with: {
            counts: {
              columns: {
                commentCount: true,
                likeCount: true,
                favoriteCount: true,
                forumTopicCount: true,
                commentReceivedLikeCount: true,
                forumTopicReceivedLikeCount: true,
                forumTopicReceivedFavoriteCount: true,
              },
            },
            level: {
              columns: {
                id: true,
                name: true,
                icon: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    })

    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }
    if (!topic.section) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    const [hashtags, auditorSummary] = await Promise.all([
      this.getTopicHashtags(topic.id),
      this.getTopicAuditorSummary({
        auditById: topic.auditById,
        auditRole: topic.auditRole,
      }),
    ])

    let points = 0
    if (topic.user) {
      const growth = await this.growthBalanceQueryService.getUserGrowthSnapshot(
        topic.userId,
      )
      points = growth.points
    }

    // 排除不应透传到 DTO 的字段：正文派生列(content/contentPreview/body/bodyVersion)、审核人内部字段(auditById/auditRole)、
    // 属地快照字段(geoCountry/geoProvince/geoCity/geoIsp/geoSource)
    const {
      content,
      contentPreview,
      body,
      bodyVersion,
      auditById,
      auditRole,
      geoCountry,
      geoProvince,
      geoCity,
      geoIsp,
      geoSource,
      images,
      videos,
      sensitiveWordHits,
      // 关系查询带出的关联对象需要在返回时重新构造，避免直接透传
      section: _section,
      user: _user,
      ...topicFields
    } = topic

    const detail: AdminForumTopicDetailDto = {
      ...topicFields,
      images: images ?? [],
      videos: this.normalizeTopicVideoOutput(videos),
      auditReason: topic.auditReason ?? null,
      auditAt: topic.auditAt ?? null,
      sensitiveWordHits:
        this.normalizeSensitiveWordHitOutput(sensitiveWordHits),
      lastCommentAt: topic.lastCommentAt ?? null,
      lastCommentUserId: topic.lastCommentUserId ?? null,
      hashtags,
      section: {
        id: topic.section.id,
        name: topic.section.name,
        description: topic.section.description,
        icon: topic.section.icon,
        cover: topic.section.cover,
        isEnabled: topic.section.isEnabled,
        topicReviewPolicy: topic.section.topicReviewPolicy,
      },
      user: topic.user
        ? {
            id: topic.user.id,
            nickname: topic.user.nickname,
            avatarUrl: topic.user.avatarUrl,
            signature: topic.user.signature,
            bio: topic.user.bio,
            isEnabled: topic.user.isEnabled,
            points,
            levelId: topic.user.levelId,
            status: topic.user.status,
            banReason: topic.user.banReason,
            banUntil: topic.user.banUntil,
            counts: topic.user.counts
              ? {
                  commentCount: topic.user.counts.commentCount,
                  likeCount: topic.user.counts.likeCount,
                  favoriteCount: topic.user.counts.favoriteCount,
                  forumTopicCount: topic.user.counts.forumTopicCount,
                  commentReceivedLikeCount:
                    topic.user.counts.commentReceivedLikeCount,
                  forumTopicReceivedLikeCount:
                    topic.user.counts.forumTopicReceivedLikeCount,
                  forumTopicReceivedFavoriteCount:
                    topic.user.counts.forumTopicReceivedFavoriteCount,
                }
              : null,
            level: topic.user.level
              ? {
                  id: topic.user.level.id,
                  name: topic.user.level.name,
                  icon: topic.user.level.icon,
                  sortOrder: topic.user.level.sortOrder,
                }
              : null,
          }
        : null,
      auditorSummary,
    }

    return detail
  }

  // 获取后台主题分页列表；后台列表仅返回展示所需字段和正文摘要，避免分页接口直接传输完整正文。
  async getTopics(queryForumTopicDto: QueryForumTopicDto) {
    const {
      deletedState = ForumTopicDeletedStateEnum.ACTIVE,
      endDate,
      keyword,
      sectionId,
      startDate,
      userId,
      ...otherDto
    } = queryForumTopicDto
    const conditions: SQL[] = []

    if (deletedState === ForumTopicDeletedStateEnum.ACTIVE) {
      conditions.push(isNull(this.forumTopicTable.deletedAt))
    } else if (deletedState === ForumTopicDeletedStateEnum.DELETED) {
      conditions.push(isNotNull(this.forumTopicTable.deletedAt))
    } else if (deletedState !== ForumTopicDeletedStateEnum.ALL) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '不支持的主题删除状态筛选',
      )
    }

    if (sectionId !== undefined) {
      conditions.push(eq(this.forumTopicTable.sectionId, sectionId))
    }
    if (userId !== undefined) {
      conditions.push(eq(this.forumTopicTable.userId, userId))
    }
    if (otherDto.isPinned !== undefined) {
      conditions.push(eq(this.forumTopicTable.isPinned, otherDto.isPinned))
    }
    if (otherDto.isFeatured !== undefined) {
      conditions.push(eq(this.forumTopicTable.isFeatured, otherDto.isFeatured))
    }
    if (otherDto.isLocked !== undefined) {
      conditions.push(eq(this.forumTopicTable.isLocked, otherDto.isLocked))
    }
    if (otherDto.isHidden !== undefined) {
      conditions.push(eq(this.forumTopicTable.isHidden, otherDto.isHidden))
    }
    if (otherDto.auditStatus !== undefined) {
      conditions.push(
        eq(this.forumTopicTable.auditStatus, otherDto.auditStatus),
      )
    }
    if (keyword) {
      const keywordLike = buildLikePattern(keyword)!
      conditions.push(
        or(
          ilike(this.forumTopicTable.title, keywordLike),
          ilike(this.forumTopicTable.content, keywordLike),
        )!,
      )
    }
    const createdRange = buildDateOnlyRangeInAppTimeZone(startDate, endDate)
    if (createdRange?.gte) {
      conditions.push(gte(this.forumTopicTable.createdAt, createdRange.gte))
    }
    if (createdRange?.lt) {
      conditions.push(lt(this.forumTopicTable.createdAt, createdRange.lt))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage({
      pageIndex: otherDto.pageIndex,
      pageSize: otherDto.pageSize,
    })
    const order = this.drizzle.buildAllowlistedOrderBy(otherDto.orderBy, {
      columns: this.getAdminTopicOrderColumns(),
      fallbackOrderBy: DEFAULT_ADMIN_TOPIC_PAGE_ORDER,
    })

    const listQuery = this.db
      .select({
        id: this.forumTopicTable.id,
        sectionId: this.forumTopicTable.sectionId,
        userId: this.forumTopicTable.userId,
        title: this.forumTopicTable.title,
        isPinned: this.forumTopicTable.isPinned,
        isFeatured: this.forumTopicTable.isFeatured,
        isLocked: this.forumTopicTable.isLocked,
        isHidden: this.forumTopicTable.isHidden,
        auditStatus: this.forumTopicTable.auditStatus,
        commentCount: this.forumTopicTable.commentCount,
        likeCount: this.forumTopicTable.likeCount,
        createdAt: this.forumTopicTable.createdAt,
        deletedAt: this.forumTopicTable.deletedAt,
      })
      .from(this.forumTopicTable)
      .where(where)
      .limit(page.limit)
      .offset(page.offset)

    const [list, total] = await Promise.all([
      listQuery.orderBy(...order.orderBySql),
      this.db.$count(this.forumTopicTable, where),
    ])

    return toPageResult(
      await this.hydrateAdminTopicPageItems(list),
      total,
      page,
    )
  }
}
