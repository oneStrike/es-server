import type { ForumTopicSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  ForumSearchCondition,
  ForumSearchConditionTuple,
} from './search.type'

import { buildLikePattern, DrizzleService, toPageResult } from '@db/core'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { AuditStatusEnum } from '@libs/platform/constant'
import type { CursorContextFingerprint } from '@libs/platform/utils'
import {
  assertSameCursorContextFingerprint,
  normalizeCursorEnum,
  normalizeCursorNumber,
  normalizeCursorText,
  normalizeCursorViewerScope,
  parseCursorContextFingerprint,
} from '@libs/platform/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, desc, eq, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { ForumHashtagReferenceSourceTypeEnum } from '../hashtag/forum-hashtag.constant'
import { ForumPermissionService } from '../permission/forum-permission.service'
import {
  ForumSearchDto,
  ForumSearchResultDto,
  PublicForumSearchDto,
} from './dto/search.dto'
import { ForumSearchSortTypeEnum, ForumSearchTypeEnum } from './search.constant'

const FORUM_SEARCH_TOPIC_RANK = 0
const FORUM_SEARCH_COMMENT_RANK = 1

interface ForumSearchCursorQueryFingerprint extends CursorContextFingerprint {
  keyword: string
  type: ForumSearchTypeEnum
  sectionId: number | null
  hashtagId: number | null
  sort: ForumSearchSortTypeEnum
  viewerScope: string
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

  /** 统一复用当前模块的 Drizzle 数据库实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** forum_topic 表访问入口。 */
  get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  /** user_comment 表访问入口。 */
  get userComment() {
    return this.drizzle.schema.userComment
  }

  /** forum_hashtag_reference 表访问入口。 */
  get forumHashtagReference() {
    return this.drizzle.schema.forumHashtagReference
  }

  /** forum_hashtag 表访问入口。 */
  get forumHashtag() {
    return this.drizzle.schema.forumHashtag
  }

  /** forum_section 表访问入口。 */
  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  /** app_user 表访问入口。 */
  get appUser() {
    return this.drizzle.schema.appUser
  }

  /**
   * 管理端搜索。
   * 不做公开可见性过滤，返回后台可检索的主题和评论。
   */
  async searchAdmin(searchInput: ForumSearchDto) {
    return this.searchInternal(searchInput, { publicOnly: false })
  }

  /**
   * 应用侧公开搜索。
   * 会按当前用户权限收窄板块范围，并过滤未通过审核或已隐藏内容。
   */
  async searchPublic(searchInput: ForumSearchDto, userId?: number) {
    return this.searchPublicCursor(searchInput as PublicForumSearchDto, userId)
  }

  /**
   * 创建空分页结果。
   * 当板块范围或标签过滤提前确定无结果时，保持分页元数据稳定返回。
   */
  private createEmptyPage(searchInput: ForumSearchDto) {
    const page = this.drizzle.buildPage(searchInput)

    return {
      list: [],
      total: 0,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  /**
   * 生成关键词摘要。
   * 优先截取命中片段附近内容，未命中时退回前缀截断，避免返回整段正文。
   */
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

  /**
   * 根据排序模式生成主题排序规则。
   * hot 模式按互动指标聚合回退到发布时间，其它模式统一按最新时间倒序。
   */
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

  /**
   * 根据排序模式生成评论排序规则。
   * 评论热度优先看点赞数，再以发布时间兜底。
   */
  private getCommentOrderBy(sort?: ForumSearchSortTypeEnum) {
    if (sort === ForumSearchSortTypeEnum.HOT) {
      return [
        desc(this.userComment.likeCount),
        desc(this.userComment.createdAt),
        desc(this.userComment.id),
      ]
    }

    return [desc(this.userComment.createdAt), desc(this.userComment.id)]
  }

  private getTopicHotScoreSql() {
    return sql<number>`(${this.forumTopic.commentCount} * 5 + ${this.forumTopic.likeCount} * 3 + ${this.forumTopic.favoriteCount} * 3 + ${this.forumTopic.viewCount})::int`
  }

  private getCommentHotScoreSql() {
    return sql<number>`(${this.forumTopic.commentCount} * 5 + ${this.userComment.likeCount} * 3 + ${this.forumTopic.favoriteCount} * 3 + ${this.forumTopic.viewCount})::int`
  }

  private getPublicTopicCursorOrderBy(sort?: ForumSearchSortTypeEnum) {
    if (sort === ForumSearchSortTypeEnum.HOT) {
      return [
        desc(this.getTopicHotScoreSql()),
        desc(this.forumTopic.createdAt),
        desc(this.forumTopic.id),
      ]
    }

    return [desc(this.forumTopic.createdAt), desc(this.forumTopic.id)]
  }

  private getPublicCommentCursorOrderBy(sort?: ForumSearchSortTypeEnum) {
    if (sort === ForumSearchSortTypeEnum.HOT) {
      return [
        desc(this.getCommentHotScoreSql()),
        desc(this.userComment.createdAt),
        desc(this.userComment.id),
        desc(this.forumTopic.id),
      ]
    }

    return [
      desc(this.userComment.createdAt),
      desc(this.userComment.id),
      desc(this.forumTopic.id),
    ]
  }

  private assertPublicCursorQuery(query: Record<string, unknown>) {
    const unsupportedFields = ['pageIndex', 'orderBy', 'startDate', 'endDate']
      .filter((field) => query[field] !== undefined)

    if (unsupportedFields.length > 0) {
      throw new BadRequestException(
        `论坛公开搜索仅支持 pageSize 和 cursor 查询，不支持 ${unsupportedFields.join(', ')}`,
      )
    }
  }

  private encodeSearchCursor(
    item: ForumSearchResultDto,
    sort: ForumSearchSortTypeEnum,
    queryFingerprint: ForumSearchCursorQueryFingerprint,
  ) {
    const hotScore =
      item.commentCount * 5 +
      item.likeCount * 3 +
      item.favoriteCount * 3 +
      item.viewCount

    return Buffer.from(
      JSON.stringify({
        sort,
        queryFingerprint,
        hotScore,
        createdAt: item.createdAt.toISOString(),
        resultTypeRank: this.getSearchResultTypeRank(item),
        commentIdForSort: item.commentId ?? 0,
        topicId: item.topicId,
        commentId: item.commentId,
      }),
    ).toString('base64url')
  }

  private parseSearchCursor(cursor?: string | null) {
    if (!cursor?.trim()) {
      return null
    }

    try {
      const payload = JSON.parse(
        Buffer.from(cursor.trim(), 'base64url').toString('utf8'),
      )
      const sort = String(payload.sort)
      const createdAt = new Date(String(payload.createdAt))
      const hotScore = Number(payload.hotScore)
      const queryFingerprint = this.parseSearchQueryFingerprint(
        payload.queryFingerprint,
      )
      const resultTypeRank = Number(payload.resultTypeRank)
      const commentIdForSort = Number(payload.commentIdForSort)
      const topicId = Number(payload.topicId)
      const commentId =
        payload.commentId === null || payload.commentId === undefined
          ? null
          : Number(payload.commentId)

      if (
        !Object.values(ForumSearchSortTypeEnum).includes(
          sort as ForumSearchSortTypeEnum,
        ) ||
        queryFingerprint.sort !== sort ||
        Number.isNaN(createdAt.getTime()) ||
        !Number.isFinite(hotScore) ||
        ![FORUM_SEARCH_TOPIC_RANK, FORUM_SEARCH_COMMENT_RANK].includes(
          resultTypeRank,
        ) ||
        !Number.isInteger(commentIdForSort) ||
        !Number.isInteger(topicId) ||
        topicId < 1 ||
        (commentId !== null && (!Number.isInteger(commentId) || commentId < 1)) ||
        (resultTypeRank === FORUM_SEARCH_TOPIC_RANK &&
          (commentId !== null || commentIdForSort !== 0)) ||
        (resultTypeRank === FORUM_SEARCH_COMMENT_RANK &&
          (commentId === null || commentIdForSort !== commentId))
      ) {
        throw new TypeError('invalid forum search cursor')
      }

      return {
        sort: sort as ForumSearchSortTypeEnum,
        queryFingerprint,
        createdAt,
        hotScore,
        resultTypeRank,
        commentIdForSort,
        topicId,
        commentId,
      }
    }
    catch {
      throw new BadRequestException('论坛搜索分页游标非法')
    }
  }

  private buildSearchQueryFingerprint(
    dto: Pick<
      PublicForumSearchDto,
      'keyword' | 'type' | 'sectionId' | 'hashtagId' | 'sort'
    >,
    userId?: number,
  ): ForumSearchCursorQueryFingerprint {
    return {
      keyword: normalizeCursorText(dto.keyword, { emptyValue: '' }) ?? '',
      type: normalizeCursorEnum(dto.type, ForumSearchTypeEnum.ALL),
      sectionId: normalizeCursorNumber(dto.sectionId),
      hashtagId: normalizeCursorNumber(dto.hashtagId),
      sort: normalizeCursorEnum(dto.sort, ForumSearchSortTypeEnum.RELEVANCE),
      viewerScope: normalizeCursorViewerScope(userId),
    }
  }

  private parseSearchQueryFingerprint(
    input: unknown,
  ): ForumSearchCursorQueryFingerprint {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('missing forum search query fingerprint')
    }
    const payload = parseCursorContextFingerprint(input)
    const keyword = normalizeCursorText(payload.keyword, { emptyValue: '' }) ?? ''
    const type = String(payload.type)
    const sectionId = normalizeCursorNumber(payload.sectionId)
    const hashtagId = normalizeCursorNumber(payload.hashtagId)
    const sort = String(payload.sort)
    const viewerScope = String(payload.viewerScope ?? '')

    if (
      !Object.values(ForumSearchTypeEnum).includes(type as ForumSearchTypeEnum) ||
      !Object.values(ForumSearchSortTypeEnum).includes(
        sort as ForumSearchSortTypeEnum,
      ) ||
      !/^guest$|^user:\d+$/.test(viewerScope)
    ) {
      throw new TypeError('invalid forum search query fingerprint')
    }

    return {
      keyword,
      type: type as ForumSearchTypeEnum,
      sectionId,
      hashtagId,
      sort: sort as ForumSearchSortTypeEnum,
      viewerScope,
    }
  }

  private assertSameSearchQueryFingerprint(
    left: ForumSearchCursorQueryFingerprint,
    right: ForumSearchCursorQueryFingerprint,
  ) {
    assertSameCursorContextFingerprint(
      left,
      right,
      () => new BadRequestException('论坛搜索分页游标与搜索条件不匹配'),
    )
  }

  private buildTopicSearchCursorWhere(
    cursor: ReturnType<ForumSearchService['parseSearchCursor']>,
    sort?: ForumSearchSortTypeEnum,
  ) {
    if (!cursor) {
      return undefined
    }

    if (sort === ForumSearchSortTypeEnum.HOT) {
      const hotScoreSql = this.getTopicHotScoreSql()
      return or(
        sql`${hotScoreSql} < ${cursor.hotScore}`,
        and(
          sql`${hotScoreSql} = ${cursor.hotScore}`,
          this.buildTopicSearchTupleTailWhere(cursor),
        ),
      )
    }

    return this.buildTopicSearchTupleTailWhere(cursor)
  }

  private buildCommentSearchCursorWhere(
    cursor: ReturnType<ForumSearchService['parseSearchCursor']>,
    sort?: ForumSearchSortTypeEnum,
  ) {
    if (!cursor) {
      return undefined
    }

    if (sort === ForumSearchSortTypeEnum.HOT) {
      const hotScoreSql = this.getCommentHotScoreSql()
      return or(
        sql`${hotScoreSql} < ${cursor.hotScore}`,
        and(
          sql`${hotScoreSql} = ${cursor.hotScore}`,
          this.buildCommentSearchTupleTailWhere(cursor),
        ),
      )
    }

    return this.buildCommentSearchTupleTailWhere(cursor)
  }

  private buildTopicSearchTupleTailWhere(
    cursor: NonNullable<ReturnType<ForumSearchService['parseSearchCursor']>>,
  ) {
    if (cursor.resultTypeRank === FORUM_SEARCH_COMMENT_RANK) {
      return or(
        lt(this.forumTopic.createdAt, cursor.createdAt),
        eq(this.forumTopic.createdAt, cursor.createdAt),
      )!
    }

    return or(
      lt(this.forumTopic.createdAt, cursor.createdAt),
      and(
        eq(this.forumTopic.createdAt, cursor.createdAt),
        lt(this.forumTopic.id, cursor.topicId),
      ),
    )!
  }

  private buildCommentSearchTupleTailWhere(
    cursor: NonNullable<ReturnType<ForumSearchService['parseSearchCursor']>>,
  ) {
    if (cursor.resultTypeRank === FORUM_SEARCH_TOPIC_RANK) {
      return lt(this.userComment.createdAt, cursor.createdAt)
    }

    return or(
      lt(this.userComment.createdAt, cursor.createdAt),
      and(
        eq(this.userComment.createdAt, cursor.createdAt),
        or(
          lt(this.userComment.id, cursor.commentIdForSort),
          and(
            eq(this.userComment.id, cursor.commentIdForSort),
            lt(this.forumTopic.id, cursor.topicId),
          ),
        ),
      ),
    )!
  }

  /**
   * 合并搜索结果时的统一排序比较器。
   * hot 模式使用主题互动热度，非 hot 模式则统一按时间和主键倒序稳定排序。
   */
  private compareResults(
    left: ForumSearchResultDto,
    right: ForumSearchResultDto,
    sort?: ForumSearchSortTypeEnum,
  ) {
    if (sort === ForumSearchSortTypeEnum.HOT) {
      const leftHotScore =
        left.commentCount * 5 +
        left.likeCount * 3 +
        left.favoriteCount * 3 +
        left.viewCount
      const rightHotScore =
        right.commentCount * 5 +
        right.likeCount * 3 +
        right.favoriteCount * 3 +
        right.viewCount

      if (leftHotScore !== rightHotScore) {
        return rightHotScore - leftHotScore
      }
    }

    const createdAtDiff = right.createdAt.getTime() - left.createdAt.getTime()
    if (createdAtDiff !== 0) {
      return createdAtDiff
    }

    const resultTypeRankDiff =
      this.getSearchResultTypeRank(right) - this.getSearchResultTypeRank(left)
    if (resultTypeRankDiff !== 0) {
      return resultTypeRankDiff
    }

    const commentIdDiff = (right.commentId ?? 0) - (left.commentId ?? 0)
    if (commentIdDiff !== 0) {
      return commentIdDiff
    }

    return right.topicId - left.topicId
  }

  private getSearchResultTypeRank(item: ForumSearchResultDto) {
    return item.resultType === ForumSearchTypeEnum.COMMENT
      ? FORUM_SEARCH_COMMENT_RANK
      : FORUM_SEARCH_TOPIC_RANK
  }

  /**
   * 解析当前查询可访问的板块范围。
   * publicOnly 模式会调用权限服务校验显式 sectionId，或回退为当前用户可访问板块集合。
   */
  private async resolveSectionScope(
    sectionId: number | undefined,
    options: {
      publicOnly: boolean
      userId?: number
    },
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
    const filtered = conditions.filter(
      (condition): condition is SQL => Boolean(condition),
    )

    return filtered.length > 0
      ? (filtered as ForumSearchConditionTuple)
      : undefined
  }

  /**
   * 构建评论搜索的话题过滤条件。
   * - 同时接受“主题命中 hashtag”与“评论自身命中 hashtag”两种来源。
   */
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

  /**
   * 解析话题对应的来源 ID 集合。
   * publicOnly 模式只保留当前公开可见引用。
   */
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

  /**
   * 将主题查询结果映射为统一搜索结果 DTO。
   * 这里会补齐板块名、用户昵称和正文摘要，供分页接口直接返回。
   */
  private async mapTopicResults(
    topics: ForumTopicSelect[],
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

  /**
   * 将评论查询结果映射为统一搜索结果 DTO。
   * 评论结果保留 commentId 和评论摘要，主题维度指标仍复用所属主题的聚合字段。
   */
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

  /**
   * 搜索分发主入口。
   * all 模式会分别拉取主题与评论窗口后合并排序，保持分页层看到的是统一结果流。
   */
  private async searchInternal(
    searchInput: ForumSearchDto,
    options: {
      publicOnly: boolean
      userId?: number
    },
  ) {
    const type = searchInput.type ?? ForumSearchTypeEnum.ALL

    if (type === ForumSearchTypeEnum.TOPIC) {
      return this.searchTopics(searchInput, options)
    }

    if (type === ForumSearchTypeEnum.COMMENT) {
      return this.searchComments(searchInput, options)
    }

    const page = this.drizzle.buildPage(searchInput)
    const mergedWindowSize = page.offset + page.pageSize

    const [topicResults, commentResults] = await Promise.all([
      this.searchTopics(
        {
          ...searchInput,
          type: ForumSearchTypeEnum.TOPIC,
          pageIndex: 1,
          pageSize: mergedWindowSize,
        },
        options,
      ),
      this.searchComments(
        {
          ...searchInput,
          type: ForumSearchTypeEnum.COMMENT,
          pageIndex: 1,
          pageSize: mergedWindowSize,
        },
        options,
      ),
    ])

    const mergedList = [...topicResults.list, ...commentResults.list]
      .sort((left, right) => this.compareResults(left, right, searchInput.sort))
      .slice(page.offset, page.offset + page.pageSize)

    return {
      list: mergedList,
      total: topicResults.total + commentResults.total,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  private async searchPublicCursor(
    searchInput: PublicForumSearchDto,
    userId?: number,
  ) {
    this.assertPublicCursorQuery(searchInput as unknown as Record<string, unknown>)
    const type = searchInput.type ?? ForumSearchTypeEnum.ALL
    const page = this.drizzle.buildPage({
      pageIndex: 1,
      pageSize: searchInput.pageSize,
    })
    const effectiveSort = searchInput.sort ?? ForumSearchSortTypeEnum.RELEVANCE
    const cursor = this.parseSearchCursor(searchInput.cursor)
    const queryFingerprint = this.buildSearchQueryFingerprint(searchInput, userId)
    if (cursor) {
      this.assertSameSearchQueryFingerprint(
        cursor.queryFingerprint,
        queryFingerprint,
      )
    }

    const queryWindow = {
      ...searchInput,
      pageSize: page.pageSize + 1,
    }

    const [topicResults, commentResults] = await Promise.all([
      type === ForumSearchTypeEnum.COMMENT
        ? Promise.resolve([])
        : this.searchPublicTopicsCursor(queryWindow, userId, cursor),
      type === ForumSearchTypeEnum.TOPIC
        ? Promise.resolve([])
        : this.searchPublicCommentsCursor(queryWindow, userId, cursor),
    ])

    const merged = [...topicResults, ...commentResults]
      .sort((left, right) => this.compareResults(left, right, effectiveSort))
      .slice(0, page.limit + 1)
    const list = merged.slice(0, page.limit)
    const hasMore = merged.length > page.limit

    return {
      list,
      pageSize: page.pageSize,
      hasMore,
      nextCursor:
        hasMore && list.length > 0
          ? this.encodeSearchCursor(
              list[list.length - 1],
              effectiveSort,
              queryFingerprint,
            )
          : null,
    }
  }

  private async searchPublicTopicsCursor(
    dto: PublicForumSearchDto,
    userId: number | undefined,
    cursor: ReturnType<ForumSearchService['parseSearchCursor']>,
  ) {
    const sectionIds = await this.resolveSectionScope(dto.sectionId, {
      publicOnly: true,
      userId,
    })
    if (sectionIds && sectionIds.length === 0) {
      return []
    }

    const topicIdsByHashtag = dto.hashtagId
      ? await this.getSourceIdsByHashtag(
          dto.hashtagId,
          ForumHashtagReferenceSourceTypeEnum.TOPIC,
          { publicOnly: true },
        )
      : undefined
    if (topicIdsByHashtag && topicIdsByHashtag.length === 0) {
      return []
    }

    const keywordLike = buildLikePattern(dto.keyword)!
    const cursorWhere = this.buildTopicSearchCursorWhere(cursor, dto.sort)
    const conditionTuple = this.compactConditions([
      isNull(this.forumTopic.deletedAt),
      or(
        ilike(this.forumTopic.title, keywordLike),
        ilike(this.forumTopic.content, keywordLike),
      ),
      eq(this.forumTopic.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.forumTopic.isHidden, false),
      sectionIds
        ? sectionIds.length === 1
          ? eq(this.forumTopic.sectionId, sectionIds[0])
          : inArray(this.forumTopic.sectionId, sectionIds)
        : undefined,
      topicIdsByHashtag
        ? inArray(this.forumTopic.id, topicIdsByHashtag)
        : undefined,
      cursorWhere,
    ])!

    const rows = await this.db
      .select()
      .from(this.forumTopic)
      .where(and(...conditionTuple))
      .orderBy(...this.getPublicTopicCursorOrderBy(dto.sort))
      .limit((dto.pageSize ?? 10) + 1)

    return this.mapTopicResults(rows, dto.keyword)
  }

  private async searchPublicCommentsCursor(
    dto: PublicForumSearchDto,
    userId: number | undefined,
    cursor: ReturnType<ForumSearchService['parseSearchCursor']>,
  ) {
    const sectionIds = await this.resolveSectionScope(dto.sectionId, {
      publicOnly: true,
      userId,
    })
    if (sectionIds && sectionIds.length === 0) {
      return []
    }

    const [topicIdsByHashtag, commentIdsByHashtag] = dto.hashtagId
      ? await Promise.all([
          this.getSourceIdsByHashtag(
            dto.hashtagId,
            ForumHashtagReferenceSourceTypeEnum.TOPIC,
            { publicOnly: true },
          ),
          this.getSourceIdsByHashtag(
            dto.hashtagId,
            ForumHashtagReferenceSourceTypeEnum.COMMENT,
            { publicOnly: true },
          ),
        ])
      : [undefined, undefined]
    if (
      dto.hashtagId &&
      (topicIdsByHashtag?.length ?? 0) === 0 &&
      (commentIdsByHashtag?.length ?? 0) === 0
    ) {
      return []
    }

    const keywordLike = buildLikePattern(dto.keyword)!
    const cursorWhere = this.buildCommentSearchCursorWhere(cursor, dto.sort)
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
      eq(this.userComment.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.userComment.isHidden, false),
      eq(this.forumTopic.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.forumTopic.isHidden, false),
      sectionIds
        ? sectionIds.length === 1
          ? eq(this.forumTopic.sectionId, sectionIds[0])
          : inArray(this.forumTopic.sectionId, sectionIds)
        : undefined,
      commentHashtagFilter,
      cursorWhere,
    ])!

    const rows = await this.db
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
      .where(and(...conditionTuple))
      .orderBy(...this.getPublicCommentCursorOrderBy(dto.sort))
      .limit((dto.pageSize ?? 10) + 1)

    return this.mapCommentResults(rows, dto.keyword)
  }

  /**
   * 搜索主题。
   * public 模式下会叠加审核与隐藏过滤，并支持按话题引用缩小结果集。
   */
  private async searchTopics(
    dto: ForumSearchDto,
    options: {
      publicOnly: boolean
      userId?: number
    },
  ) {
    const sectionIds = await this.resolveSectionScope(dto.sectionId, options)
    if (sectionIds && sectionIds.length === 0) {
      return this.createEmptyPage(dto)
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
      return this.createEmptyPage(dto)
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
    ])!

    const where = and(...conditionTuple)
    const pageQuery = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(this.getTopicOrderBy(dto.sort), {
      table: this.forumTopic,
    })
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.forumTopic)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.forumTopic, where),
    ])
    const page = toPageResult(list, total, pageQuery)

    return {
      ...page,
      list: await this.mapTopicResults(page.list, dto.keyword),
    }
  }

  /**
   * 搜索评论。
   * 评论搜索通过 join 主题表继承板块和审核过滤。
   * 评论搜索同时接受主题级引用与评论级引用，保证话题筛选口径覆盖完整。
   */
  private async searchComments(
    dto: ForumSearchDto,
    options: {
      publicOnly: boolean
      userId?: number
    },
  ) {
    const sectionIds = await this.resolveSectionScope(dto.sectionId, options)
    if (sectionIds && sectionIds.length === 0) {
      return this.createEmptyPage(dto)
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
      return this.createEmptyPage(dto)
    }

    const page = this.drizzle.buildPage(dto)
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
    ])!

    const where = and(...conditionTuple)

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
        .orderBy(...this.getCommentOrderBy(dto.sort))
        .limit(page.limit)
        .offset(page.offset),
      this.db
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(this.userComment)
        .innerJoin(
          this.forumTopic,
          eq(this.userComment.targetId, this.forumTopic.id),
        )
        .where(where),
    ])

    return {
      list: await this.mapCommentResults(rows, dto.keyword),
      total: totalRows[0]?.total ?? 0,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }
}
