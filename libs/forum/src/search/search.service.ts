import type { ForumTopicSelect } from '@db/schema'
import type { AppDateRange } from '@libs/platform/utils'
import type { SQL } from 'drizzle-orm'
import type {
  ForumSearchCondition,
  ForumSearchConditionTuple,
} from './search.type'

import { buildLikePattern, DrizzleService, toPageResult } from '@db/core'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { AuditStatusEnum } from '@libs/platform/constant'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm'
import { ForumHashtagReferenceSourceTypeEnum } from '../hashtag/forum-hashtag.constant'
import { ForumPermissionService } from '../permission/forum-permission.service'
import {
  ForumSearchDto,
  ForumSearchResultDto,
  PublicForumSearchDto,
} from './dto/search.dto'
import { ForumSearchSortTypeEnum, ForumSearchTypeEnum } from './search.constant'

type ForumSearchTopicSource = Pick<
  ForumTopicSelect,
  | 'id'
  | 'sectionId'
  | 'userId'
  | 'title'
  | 'content'
  | 'createdAt'
  | 'commentCount'
  | 'viewCount'
  | 'likeCount'
  | 'favoriteCount'
>

interface ForumSearchOptions {
  publicOnly: boolean
  userId?: number
}

interface ForumSearchMixedRow {
  commentContent: string | null
  commentCount: number
  commentId: number | null
  createdAt: Date
  favoriteCount: number
  likeCount: number
  resultType: ForumSearchTypeEnum
  sectionId: number
  sectionName: string | null
  topicContent: string | null
  topicId: number
  topicTitle: string
  userAvatarUrl: string | null
  userId: number
  userNickname: string | null
  viewCount: number
}

/**
 * 论坛搜索服务。
 * 统一承载主题、评论和混合搜索逻辑，并在 public 模式下叠加板块可见性与审核过滤。
 */
@Injectable()
export class ForumSearchService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly forumPermissionService: ForumPermissionService,
  ) {}

  // 统一复用当前模块的 Drizzle 数据库实例。
  private get db() {
    return this.drizzle.db
  }

  // forum_topic 表访问入口。
  get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  // user_comment 表访问入口。
  get userComment() {
    return this.drizzle.schema.userComment
  }

  // forum_hashtag_reference 表访问入口。
  get forumHashtagReference() {
    return this.drizzle.schema.forumHashtagReference
  }

  // forum_hashtag 表访问入口。
  get forumHashtag() {
    return this.drizzle.schema.forumHashtag
  }

  // forum_section 表访问入口。
  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  // app_user 表访问入口。
  get appUser() {
    return this.drizzle.schema.appUser
  }

  // 管理端搜索。 不做公开可见性过滤，返回后台可检索的主题和评论。
  async searchAdmin(searchInput: ForumSearchDto) {
    return this.searchInternal(searchInput, { publicOnly: false })
  }

  // 应用侧公开搜索。 会按当前用户权限收窄板块范围，并过滤未通过审核或已隐藏内容。
  async searchPublic(searchInput: PublicForumSearchDto, userId?: number) {
    return this.searchInternal(searchInput, { publicOnly: true, userId })
  }

  // 生成关键词摘要。 优先截取命中片段附近内容，未命中时退回前缀截断，避免返回整段正文。
  private buildSnippet(content: string, keyword: string, size = 120) {
    const normalizedContent = content.trim()
    if (!normalizedContent) {
      return ''
    }

    const lowerContent = normalizedContent.toLowerCase()
    const lowerKeyword = keyword.trim().toLowerCase()
    const matchIndex = lowerKeyword ? lowerContent.indexOf(lowerKeyword) : -1

    if (matchIndex === -1) {
      return normalizedContent.slice(0, size)
    }

    const start = Math.max(0, matchIndex - Math.floor(size / 3))
    const end = Math.min(normalizedContent.length, start + size)
    return normalizedContent.slice(start, end)
  }

  // 根据排序模式生成主题排序规则。 hot 模式按互动指标聚合回退到发布时间，其它模式统一按最新时间倒序。
  private getTopicOrderBy(sort?: ForumSearchSortTypeEnum) {
    if (sort === ForumSearchSortTypeEnum.HOT) {
      return [
        { commentCount: 'desc' as const },
        { likeCount: 'desc' as const },
        { viewCount: 'desc' as const },
        { createdAt: 'desc' as const },
        { id: 'desc' as const },
      ] as Array<Record<string, 'asc' | 'desc'>>
    }

    return [{ createdAt: 'desc' as const }, { id: 'desc' as const }] as Array<
      Record<string, 'asc' | 'desc'>
    >
  }

  // 根据排序模式生成评论排序规则。 评论热度优先看点赞数，再以发布时间兜底。
  private getCommentFallbackOrderBy(
    sort?: ForumSearchSortTypeEnum,
  ): Array<Record<string, 'asc' | 'desc'>> {
    if (sort === ForumSearchSortTypeEnum.HOT) {
      return [
        { likeCount: 'desc' as const },
        { createdAt: 'desc' as const },
        { id: 'desc' as const },
      ]
    }

    return [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
  }

  private assertSingleSearchOrderProtocol(dto: ForumSearchDto) {
    if (dto.orderBy?.trim() && dto.sort !== undefined) {
      throw new BadRequestException('论坛搜索不支持同时使用 sort 和 orderBy')
    }
  }

  private getTopicSearchOrderColumns() {
    return {
      createdAt: this.forumTopic.createdAt,
      id: this.forumTopic.id,
      commentCount: this.forumTopic.commentCount,
      viewCount: this.forumTopic.viewCount,
      likeCount: this.forumTopic.likeCount,
      favoriteCount: this.forumTopic.favoriteCount,
    }
  }

  private getCommentSearchOrderColumns() {
    return {
      createdAt: this.userComment.createdAt,
      id: this.userComment.id,
      likeCount: this.userComment.likeCount,
      commentCount: this.forumTopic.commentCount,
      viewCount: this.forumTopic.viewCount,
      favoriteCount: this.forumTopic.favoriteCount,
    }
  }

  private buildTopicSearchPageParams(dto: ForumSearchDto) {
    return this.drizzle.buildPageParams(dto, {
      allowlistedOrderBy: {
        columns: this.getTopicSearchOrderColumns(),
        fallbackOrderBy: this.getTopicOrderBy(dto.sort),
      },
    })
  }

  private buildCommentSearchPageParams(dto: ForumSearchDto) {
    return this.drizzle.buildPageParams(dto, {
      allowlistedOrderBy: {
        columns: this.getCommentSearchOrderColumns(),
        fallbackOrderBy: this.getCommentFallbackOrderBy(dto.sort),
      },
    })
  }

  // 解析当前查询可访问的板块范围。 publicOnly 模式会调用权限服务校验显式 sectionId，或回退为当前用户可访问板块集合。
  private async resolveSectionScope(
    sectionId: number | undefined,
    options: ForumSearchOptions,
  ) {
    if (!options.publicOnly) {
      return sectionId === undefined ? undefined : [sectionId]
    }

    if (sectionId !== undefined) {
      await this.forumPermissionService.ensureUserCanAccessSection(
        sectionId,
        options.userId,
        {
          requireEnabled: true,
        },
      )
      return [sectionId]
    }

    return this.forumPermissionService.getAccessibleSectionIds(options.userId)
  }

  private compactConditions(
    conditions: ForumSearchCondition[],
  ): ForumSearchConditionTuple | undefined {
    const filtered = conditions.filter((condition): condition is SQL =>
      Boolean(condition),
    )

    return filtered.length > 0
      ? (filtered as ForumSearchConditionTuple)
      : undefined
  }

  // 构建评论搜索的话题过滤条件。 - 同时接受“主题命中 hashtag”与“评论自身命中 hashtag”两种来源。
  private buildCommentHashtagFilterCondition(params: {
    topicIdsByHashtag?: number[]
    commentIdsByHashtag?: number[]
  }) {
    const conditionTuple = this.compactConditions([
      params.topicIdsByHashtag?.length
        ? inArray(this.forumTopic.id, params.topicIdsByHashtag)
        : undefined,
      params.commentIdsByHashtag?.length
        ? inArray(this.userComment.id, params.commentIdsByHashtag)
        : undefined,
    ])

    if (!conditionTuple) {
      return undefined
    }

    if (conditionTuple.length === 1) {
      return conditionTuple[0]
    }

    return or(...conditionTuple)
  }

  // 解析话题对应的来源 ID 集合。 publicOnly 模式只保留当前公开可见引用。
  private async getSourceIdsByHashtag(
    hashtagId: number,
    sourceType: ForumHashtagReferenceSourceTypeEnum,
    options: {
      publicOnly: boolean
    },
  ) {
    const rows = options.publicOnly
      ? await this.db
          .select({ sourceId: this.forumHashtagReference.sourceId })
          .from(this.forumHashtagReference)
          .innerJoin(
            this.forumHashtag,
            eq(this.forumHashtagReference.hashtagId, this.forumHashtag.id),
          )
          .where(
            and(
              eq(this.forumHashtagReference.hashtagId, hashtagId),
              eq(this.forumHashtagReference.sourceType, sourceType),
              eq(this.forumHashtagReference.isSourceVisible, true),
              eq(this.forumHashtag.auditStatus, AuditStatusEnum.APPROVED),
              eq(this.forumHashtag.isHidden, false),
              isNull(this.forumHashtag.deletedAt),
            ),
          )
      : await this.db
          .select({ sourceId: this.forumHashtagReference.sourceId })
          .from(this.forumHashtagReference)
          .where(
            and(
              eq(this.forumHashtagReference.hashtagId, hashtagId),
              eq(this.forumHashtagReference.sourceType, sourceType),
            ),
          )

    return [...new Set(rows.map((item) => item.sourceId))]
  }

  // 将主题查询结果映射为统一搜索结果 DTO。 这里会补齐板块名、用户昵称和正文摘要，供分页接口直接返回。
  private async mapTopicResults(
    topics: ForumSearchTopicSource[],
    keyword: string,
  ): Promise<ForumSearchResultDto[]> {
    if (topics.length === 0) {
      return []
    }

    const sectionIds = [...new Set(topics.map((item) => item.sectionId))]
    const userIds = [...new Set(topics.map((item) => item.userId))]

    const [sections, users] = await Promise.all([
      this.db.query.forumSection.findMany({
        where: { id: { in: sectionIds } },
        columns: {
          id: true,
          name: true,
        },
      }),
      this.db.query.appUser.findMany({
        where: { id: { in: userIds } },
        columns: {
          id: true,
          nickname: true,
          avatarUrl: true,
        },
      }),
    ])

    const sectionMap = new Map(sections.map((item) => [item.id, item.name]))
    const userMap = new Map(users.map((item) => [item.id, item]))

    return topics.map((topic) => {
      const user = userMap.get(topic.userId)

      return {
        resultType: ForumSearchTypeEnum.TOPIC,
        topicId: topic.id,
        topicTitle: topic.title,
        topicContentSnippet: this.buildSnippet(topic.content, keyword),
        sectionId: topic.sectionId,
        sectionName: sectionMap.get(topic.sectionId) ?? '',
        userId: topic.userId,
        userNickname: user?.nickname ?? '',
        userAvatarUrl: user?.avatarUrl ?? null,
        commentId: null,
        commentContentSnippet: null,
        createdAt: topic.createdAt,
        commentCount: topic.commentCount,
        viewCount: topic.viewCount,
        likeCount: topic.likeCount,
        favoriteCount: topic.favoriteCount,
      }
    })
  }

  // 将评论查询结果映射为统一搜索结果 DTO。 评论结果保留 commentId 和评论摘要，主题维度指标仍复用所属主题的聚合字段。
  private async mapCommentResults(
    comments: Array<{
      commentId: number
      topicId: number
      topicTitle: string
      sectionId: number
      userId: number
      commentContent: string
      createdAt: Date
      commentCount: number
      viewCount: number
      likeCount: number
      favoriteCount: number
    }>,
    keyword: string,
  ): Promise<ForumSearchResultDto[]> {
    if (comments.length === 0) {
      return []
    }

    const sectionIds = [...new Set(comments.map((item) => item.sectionId))]
    const userIds = [...new Set(comments.map((item) => item.userId))]

    const [sections, users] = await Promise.all([
      this.db.query.forumSection.findMany({
        where: { id: { in: sectionIds } },
        columns: {
          id: true,
          name: true,
        },
      }),
      this.db.query.appUser.findMany({
        where: { id: { in: userIds } },
        columns: {
          id: true,
          nickname: true,
          avatarUrl: true,
        },
      }),
    ])

    const sectionMap = new Map(sections.map((item) => [item.id, item.name]))
    const userMap = new Map(users.map((item) => [item.id, item]))

    return comments.map((comment) => {
      const user = userMap.get(comment.userId)

      return {
        resultType: ForumSearchTypeEnum.COMMENT,
        topicId: comment.topicId,
        topicTitle: comment.topicTitle,
        sectionId: comment.sectionId,
        sectionName: sectionMap.get(comment.sectionId) ?? '',
        userId: comment.userId,
        userNickname: user?.nickname ?? '',
        userAvatarUrl: user?.avatarUrl ?? null,
        topicContentSnippet: null,
        commentId: comment.commentId,
        commentContentSnippet: this.buildSnippet(
          comment.commentContent,
          keyword,
        ),
        createdAt: comment.createdAt,
        commentCount: comment.commentCount,
        viewCount: comment.viewCount,
        likeCount: comment.likeCount,
        favoriteCount: comment.favoriteCount,
      }
    })
  }

  private async mapMixedSearchResults(
    rows: ForumSearchMixedRow[],
    keyword: string,
  ): Promise<ForumSearchResultDto[]> {
    return rows.map((row) => {
      const isComment = row.resultType === ForumSearchTypeEnum.COMMENT

      return {
        resultType: row.resultType,
        topicId: row.topicId,
        topicTitle: row.topicTitle,
        topicContentSnippet: isComment
          ? null
          : this.buildSnippet(row.topicContent ?? '', keyword),
        sectionId: row.sectionId,
        sectionName: row.sectionName ?? '',
        userId: row.userId,
        userNickname: row.userNickname ?? '',
        userAvatarUrl: row.userAvatarUrl,
        commentId: row.commentId,
        commentContentSnippet: isComment
          ? this.buildSnippet(row.commentContent ?? '', keyword)
          : null,
        createdAt: row.createdAt,
        commentCount: row.commentCount,
        viewCount: row.viewCount,
        likeCount: row.likeCount,
        favoriteCount: row.favoriteCount,
      }
    })
  }

  // 主题和评论共用 all 查询的可见性条件；空范围显式返回 undefined，调用方不会误发全表查询。
  private async buildTopicSearchWhere(
    dto: ForumSearchDto,
    options: ForumSearchOptions,
    dateRange?: AppDateRange,
  ) {
    const sectionIds = await this.resolveSectionScope(dto.sectionId, options)
    if (sectionIds && sectionIds.length === 0) {
      return undefined
    }

    const hashtagFilterId = dto.hashtagId
    const topicIdsByHashtag = hashtagFilterId
      ? await this.getSourceIdsByHashtag(
          hashtagFilterId,
          ForumHashtagReferenceSourceTypeEnum.TOPIC,
          options,
        )
      : undefined
    if (topicIdsByHashtag && topicIdsByHashtag.length === 0) {
      return undefined
    }

    const keywordLike = buildLikePattern(dto.keyword)!
    const conditionTuple = this.compactConditions([
      isNull(this.forumTopic.deletedAt),
      or(
        ilike(this.forumTopic.title, keywordLike),
        ilike(this.forumTopic.content, keywordLike),
      ),
      options.publicOnly
        ? eq(this.forumTopic.auditStatus, AuditStatusEnum.APPROVED)
        : undefined,
      options.publicOnly ? eq(this.forumTopic.isHidden, false) : undefined,
      sectionIds
        ? sectionIds.length === 1
          ? eq(this.forumTopic.sectionId, sectionIds[0])
          : inArray(this.forumTopic.sectionId, sectionIds)
        : undefined,
      topicIdsByHashtag
        ? inArray(this.forumTopic.id, topicIdsByHashtag)
        : undefined,
      dateRange?.gte
        ? gte(this.forumTopic.createdAt, dateRange.gte)
        : undefined,
      dateRange?.lt ? lt(this.forumTopic.createdAt, dateRange.lt) : undefined,
    ])

    return conditionTuple ? and(...conditionTuple) : undefined
  }

  // 评论条件必须保留目标主题关联，确保 public/admin 可见性和 hashtag 范围与单类搜索完全一致。
  private async buildCommentSearchWhere(
    dto: ForumSearchDto,
    options: ForumSearchOptions,
    dateRange?: AppDateRange,
  ) {
    const sectionIds = await this.resolveSectionScope(dto.sectionId, options)
    if (sectionIds && sectionIds.length === 0) {
      return undefined
    }

    const hashtagFilterId = dto.hashtagId
    const [topicIdsByHashtag, commentIdsByHashtag] = hashtagFilterId
      ? await Promise.all([
          this.getSourceIdsByHashtag(
            hashtagFilterId,
            ForumHashtagReferenceSourceTypeEnum.TOPIC,
            options,
          ),
          this.getSourceIdsByHashtag(
            hashtagFilterId,
            ForumHashtagReferenceSourceTypeEnum.COMMENT,
            options,
          ),
        ])
      : [undefined, undefined]
    if (
      hashtagFilterId &&
      (topicIdsByHashtag?.length ?? 0) === 0 &&
      (commentIdsByHashtag?.length ?? 0) === 0
    ) {
      return undefined
    }

    const keywordLike = buildLikePattern(dto.keyword)!
    const commentHashtagFilter = this.buildCommentHashtagFilterCondition({
      topicIdsByHashtag,
      commentIdsByHashtag,
    })
    const conditionTuple = this.compactConditions([
      eq(this.userComment.targetType, CommentTargetTypeEnum.FORUM_TOPIC),
      isNull(this.userComment.deletedAt),
      ilike(this.userComment.content, keywordLike),
      eq(this.userComment.targetId, this.forumTopic.id),
      isNull(this.forumTopic.deletedAt),
      options.publicOnly
        ? eq(this.userComment.auditStatus, AuditStatusEnum.APPROVED)
        : undefined,
      options.publicOnly ? eq(this.userComment.isHidden, false) : undefined,
      options.publicOnly
        ? eq(this.forumTopic.auditStatus, AuditStatusEnum.APPROVED)
        : undefined,
      options.publicOnly ? eq(this.forumTopic.isHidden, false) : undefined,
      sectionIds
        ? sectionIds.length === 1
          ? eq(this.forumTopic.sectionId, sectionIds[0])
          : inArray(this.forumTopic.sectionId, sectionIds)
        : undefined,
      commentHashtagFilter,
      dateRange?.gte
        ? gte(this.userComment.createdAt, dateRange.gte)
        : undefined,
      dateRange?.lt ? lt(this.userComment.createdAt, dateRange.lt) : undefined,
    ])

    return conditionTuple ? and(...conditionTuple) : undefined
  }

  // all 模式在数据库中 union all 后再做稳定排序和分页，避免深页受 PageDto 单次 pageSize 上限截断。
  private async searchAll(dto: ForumSearchDto, options: ForumSearchOptions) {
    const pageParams = this.drizzle.buildPageParams(dto)
    const [topicWhere, commentWhere] = await Promise.all([
      this.buildTopicSearchWhere(dto, options, pageParams.dateRange),
      this.buildCommentSearchWhere(dto, options, pageParams.dateRange),
    ])
    if (!topicWhere && !commentWhere) {
      return toPageResult([], 0, pageParams.page)
    }

    const topicRows = this.db
      .select({
        commentCount: this.forumTopic.commentCount,
        commentId: sql<number | null>`null::integer`.as('comment_id'),
        createdAt: this.forumTopic.createdAt,
        favoriteCount: this.forumTopic.favoriteCount,
        likeCount: this.forumTopic.likeCount,
        resultType: sql<ForumSearchTypeEnum>`'topic'`.as('result_type'),
        resultTypeRank: sql`0::integer`.mapWith(Number).as('result_type_rank'),
        sortCommentId: sql`0::integer`.mapWith(Number).as('sort_comment_id'),
        topicId: this.forumTopic.id,
        userId: this.forumTopic.userId,
        viewCount: this.forumTopic.viewCount,
      })
      .from(this.forumTopic)
      .where(topicWhere ?? sql`false`)
    const commentRows = this.db
      .select({
        commentCount: this.forumTopic.commentCount,
        commentId: sql<number | null>`${this.userComment.id}`.as('comment_id'),
        createdAt: this.userComment.createdAt,
        favoriteCount: this.forumTopic.favoriteCount,
        likeCount: this.userComment.likeCount,
        resultType: sql<ForumSearchTypeEnum>`'comment'`.as('result_type'),
        resultTypeRank: sql`1::integer`.mapWith(Number).as('result_type_rank'),
        sortCommentId: this.userComment.id,
        topicId: this.forumTopic.id,
        userId: this.userComment.userId,
        viewCount: this.forumTopic.viewCount,
      })
      .from(this.userComment)
      .innerJoin(
        this.forumTopic,
        eq(this.userComment.targetId, this.forumTopic.id),
      )
      .where(commentWhere ?? sql`false`)
    const mixedSearchRows = this.db
      .$with('forum_search')
      .as(topicRows.unionAll(commentRows))
    const explicitOrderBy = this.drizzle.buildAllowlistedOrderBy(dto.orderBy, {
      columns: {
        commentCount: mixedSearchRows.commentCount,
        createdAt: mixedSearchRows.createdAt,
        favoriteCount: mixedSearchRows.favoriteCount,
        likeCount: mixedSearchRows.likeCount,
        viewCount: mixedSearchRows.viewCount,
      },
    }).orderBySql
    const hotScore = sql`(
      ${mixedSearchRows.commentCount}::bigint * 5 +
      ${mixedSearchRows.likeCount}::bigint * 3 +
      ${mixedSearchRows.favoriteCount}::bigint * 3 +
      ${mixedSearchRows.viewCount}::bigint
    )`
    const fallbackOrderBy = [
      ...(dto.sort === ForumSearchSortTypeEnum.HOT ? [desc(hotScore)] : []),
      desc(mixedSearchRows.createdAt),
      desc(mixedSearchRows.resultTypeRank),
      desc(mixedSearchRows.sortCommentId),
      desc(mixedSearchRows.topicId),
    ]
    const pagedSearchRows = this.db.$with('forum_search_page').as(
      this.db
        .select({
          commentCount: mixedSearchRows.commentCount,
          commentId: mixedSearchRows.commentId,
          createdAt: mixedSearchRows.createdAt,
          favoriteCount: mixedSearchRows.favoriteCount,
          likeCount: mixedSearchRows.likeCount,
          resultType: mixedSearchRows.resultType,
          topicId: mixedSearchRows.topicId,
          userId: mixedSearchRows.userId,
          viewCount: mixedSearchRows.viewCount,
        })
        .from(mixedSearchRows)
        .orderBy(...explicitOrderBy, ...fallbackOrderBy)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
    )
    const searchTotal = this.db.$with('forum_search_total').as(
      this.db
        .select({
          total: sql<number>`count(*)::bigint`.mapWith(Number).as('total'),
        })
        .from(mixedSearchRows),
    )
    const rows = await this.db
      .with(mixedSearchRows, pagedSearchRows, searchTotal)
      .select({
        commentContent: this.userComment.content,
        commentCount: pagedSearchRows.commentCount,
        commentId: pagedSearchRows.commentId,
        createdAt: pagedSearchRows.createdAt,
        favoriteCount: pagedSearchRows.favoriteCount,
        likeCount: pagedSearchRows.likeCount,
        resultType: pagedSearchRows.resultType,
        sectionId: this.forumTopic.sectionId,
        sectionName: this.forumSection.name,
        topicContent: this.forumTopic.content,
        topicId: pagedSearchRows.topicId,
        topicTitle: this.forumTopic.title,
        total: searchTotal.total,
        userAvatarUrl: this.appUser.avatarUrl,
        userId: pagedSearchRows.userId,
        userNickname: this.appUser.nickname,
        viewCount: pagedSearchRows.viewCount,
      })
      .from(searchTotal)
      .leftJoin(pagedSearchRows, sql`true`)
      .leftJoin(
        this.forumTopic,
        eq(pagedSearchRows.topicId, this.forumTopic.id),
      )
      .leftJoin(
        this.userComment,
        eq(pagedSearchRows.commentId, this.userComment.id),
      )
      .leftJoin(
        this.forumSection,
        eq(this.forumTopic.sectionId, this.forumSection.id),
      )
      .leftJoin(this.appUser, eq(pagedSearchRows.userId, this.appUser.id))
    const list: ForumSearchMixedRow[] = []
    for (const row of rows) {
      if (
        row.commentCount === null ||
        row.createdAt === null ||
        row.favoriteCount === null ||
        row.likeCount === null ||
        row.resultType === null ||
        row.sectionId === null ||
        row.topicId === null ||
        row.topicTitle === null ||
        row.userId === null ||
        row.viewCount === null
      ) {
        continue
      }

      list.push({
        commentContent: row.commentContent,
        commentCount: row.commentCount,
        commentId: row.commentId,
        createdAt: row.createdAt,
        favoriteCount: row.favoriteCount,
        likeCount: row.likeCount,
        resultType: row.resultType,
        sectionId: row.sectionId,
        sectionName: row.sectionName,
        topicContent: row.topicContent,
        topicId: row.topicId,
        topicTitle: row.topicTitle,
        userAvatarUrl: row.userAvatarUrl,
        userId: row.userId,
        userNickname: row.userNickname,
        viewCount: row.viewCount,
      })
    }

    return toPageResult(
      await this.mapMixedSearchResults(list, dto.keyword),
      rows[0]?.total ?? 0,
      pageParams.page,
    )
  }

  // 搜索分发主入口。 all 模式由数据库完成集合合并、稳定排序和分页，单类搜索保留各自的排序协议。
  private async searchInternal(
    searchInput: ForumSearchDto,
    options: ForumSearchOptions,
  ) {
    this.assertSingleSearchOrderProtocol(searchInput)
    const type = searchInput.type ?? ForumSearchTypeEnum.ALL

    if (type === ForumSearchTypeEnum.TOPIC) {
      return this.searchTopics(searchInput, options)
    }

    if (type === ForumSearchTypeEnum.COMMENT) {
      return this.searchComments(searchInput, options)
    }

    return this.searchAll(searchInput, options)
  }

  // 搜索主题。 public 模式下会叠加审核与隐藏过滤，并支持按话题引用缩小结果集。
  private async searchTopics(dto: ForumSearchDto, options: ForumSearchOptions) {
    const pageParams = this.buildTopicSearchPageParams(dto)
    const where = await this.buildTopicSearchWhere(
      dto,
      options,
      pageParams.dateRange,
    )
    if (!where) {
      return toPageResult([], 0, pageParams.page)
    }

    const [list, total] = await Promise.all([
      this.db
        .select({
          id: this.forumTopic.id,
          sectionId: this.forumTopic.sectionId,
          userId: this.forumTopic.userId,
          title: this.forumTopic.title,
          content: this.forumTopic.content,
          createdAt: this.forumTopic.createdAt,
          commentCount: this.forumTopic.commentCount,
          viewCount: this.forumTopic.viewCount,
          likeCount: this.forumTopic.likeCount,
          favoriteCount: this.forumTopic.favoriteCount,
        })
        .from(this.forumTopic)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.forumTopic, where),
    ])
    const page = toPageResult(list, total, pageParams.page)

    return {
      ...page,
      list: await this.mapTopicResults(page.list, dto.keyword),
    }
  }

  // 搜索评论。 评论搜索通过 join 主题表继承板块和审核过滤。 评论搜索同时接受主题级引用与评论级引用，保证话题筛选口径覆盖完整。
  private async searchComments(
    dto: ForumSearchDto,
    options: ForumSearchOptions,
  ) {
    const pageParams = this.buildCommentSearchPageParams(dto)
    const where = await this.buildCommentSearchWhere(
      dto,
      options,
      pageParams.dateRange,
    )
    if (!where) {
      return toPageResult([], 0, pageParams.page)
    }

    const [rows, totalRows] = await Promise.all([
      this.db
        .select({
          commentId: this.userComment.id,
          topicId: this.forumTopic.id,
          topicTitle: this.forumTopic.title,
          sectionId: this.forumTopic.sectionId,
          userId: this.userComment.userId,
          commentContent: this.userComment.content,
          createdAt: this.userComment.createdAt,
          commentCount: this.forumTopic.commentCount,
          viewCount: this.forumTopic.viewCount,
          likeCount: this.userComment.likeCount,
          favoriteCount: this.forumTopic.favoriteCount,
        })
        .from(this.userComment)
        .innerJoin(
          this.forumTopic,
          eq(this.userComment.targetId, this.forumTopic.id),
        )
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db
        .select({
          total: sql<number>`count(*)::int`.mapWith(Number),
        })
        .from(this.userComment)
        .innerJoin(
          this.forumTopic,
          eq(this.userComment.targetId, this.forumTopic.id),
        )
        .where(where),
    ])

    return toPageResult(
      await this.mapCommentResults(rows, dto.keyword),
      totalRows[0]?.total ?? 0,
      pageParams.page,
    )
  }
}
