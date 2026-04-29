import type { ForumTopicSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  ForumSearchCondition,
  ForumSearchConditionTuple,
} from './search.type'

import { buildLikePattern, DrizzleService } from '@db/core'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { AuditStatusEnum } from '@libs/platform/constant'
import { Injectable } from '@nestjs/common'
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { ForumHashtagReferenceSourceTypeEnum } from '../hashtag/forum-hashtag.constant'
import { ForumPermissionService } from '../permission/forum-permission.service'
import { ForumSearchDto, ForumSearchResultDto } from './dto/search.dto'
import { ForumSearchSortTypeEnum, ForumSearchTypeEnum } from './search.constant'

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
   * 兼容旧入口的后台搜索代理。
   * 当前直接复用管理端搜索逻辑，避免在调用侧维护第二套接口。
   */
  async search(searchInput: ForumSearchDto) {
    return this.searchAdmin(searchInput)
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
    return this.searchInternal(searchInput, { publicOnly: true, userId })
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
      ] as Array<Record<string, 'asc' | 'desc'>>
    }

    return [{ createdAt: 'desc' as const }] as Array<
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
      ]
    }

    return [desc(this.userComment.createdAt)]
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

    if ((right.commentId ?? 0) !== (left.commentId ?? 0)) {
      return (right.commentId ?? 0) - (left.commentId ?? 0)
    }

    return right.topicId - left.topicId
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

  /**
   * 解析话题筛选 ID。
   * - 新合同使用 hashtagId。
   * - 兼容期内继续接受旧 tagId，优先采用新字段。
   */
  private resolveHashtagFilterId(
    dto: Pick<ForumSearchDto, 'hashtagId' | 'tagId'>,
  ) {
    return dto.hashtagId ?? dto.tagId
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
   * - 兼容期内同时接受“主题命中 hashtag”与“评论自身命中 hashtag”两种来源。
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
        userAvatarUrl: user?.avatarUrl ?? undefined,
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
        userAvatarUrl: user?.avatarUrl ?? undefined,
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

    const hashtagFilterId = this.resolveHashtagFilterId(dto)
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

    const page = await this.drizzle.ext.findPagination(this.forumTopic, {
      where: and(...conditionTuple),
      ...dto,
      orderBy: this.getTopicOrderBy(dto.sort),
    })

    return {
      ...page,
      list: await this.mapTopicResults(page.list, dto.keyword),
    }
  }

  /**
   * 搜索评论。
   * 评论搜索通过 join 主题表继承板块和审核过滤。
   * hashtag 兼容期内同时接受主题级引用与评论级引用，保证旧 tag 搜索口径不被收窄。
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

    const hashtagFilterId = this.resolveHashtagFilterId(dto)
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
