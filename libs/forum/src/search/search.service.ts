import type { ForumTopic } from '@db/schema'
import type {
  ForumSearchInput,
  ForumSearchPageResult,
  ForumSearchResultItem,
} from './search.type'
import { DrizzleService } from '@db/core'
import { CommentTargetTypeEnum } from '@libs/interaction/comment'
import { AuditStatusEnum } from '@libs/platform/constant'
import { Injectable } from '@nestjs/common'
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { ForumPermissionService } from '../permission'
import { ForumSearchSortTypeEnum, ForumSearchTypeEnum } from './search.constant'

/**
 * 论坛搜索服务类
 * 支持主题与评论的关键词检索及混合搜索
 */
@Injectable()
export class ForumSearchService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly forumPermissionService: ForumPermissionService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  /**
   * 获取主题模型
   */
  get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  /**
   * 获取评论模型
   */
  get userComment() {
    return this.drizzle.schema.userComment
  }

  get forumTopicTag() {
    return this.drizzle.schema.forumTopicTag
  }

  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  get appUser() {
    return this.drizzle.schema.appUser
  }

  async search(searchInput: ForumSearchInput) {
    return this.searchAdmin(searchInput)
  }

  async searchAdmin(searchInput: ForumSearchInput) {
    return this.searchInternal(searchInput, { publicOnly: false })
  }

  async searchPublic(searchInput: ForumSearchInput, userId?: number) {
    return this.searchInternal(searchInput, { publicOnly: true, userId })
  }

  private createEmptyPage(searchInput: ForumSearchInput): ForumSearchPageResult {
    const pageQuery = this.drizzle.buildPageQuery(searchInput)

    return {
      list: [],
      total: 0,
      pageIndex: pageQuery.pageIndex,
      pageSize: pageQuery.pageSize,
    }
  }

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

  private getCommentOrderBy(sort?: ForumSearchSortTypeEnum) {
    if (sort === ForumSearchSortTypeEnum.HOT) {
      return [
        desc(this.userComment.likeCount),
        desc(this.userComment.createdAt),
      ]
    }

    return [desc(this.userComment.createdAt)]
  }

  private compareResults(
    left: ForumSearchResultItem,
    right: ForumSearchResultItem,
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

    const createdAtDiff =
      right.createdAt.getTime() - left.createdAt.getTime()
    if (createdAtDiff !== 0) {
      return createdAtDiff
    }

    if ((right.commentId ?? 0) !== (left.commentId ?? 0)) {
      return (right.commentId ?? 0) - (left.commentId ?? 0)
    }

    return right.topicId - left.topicId
  }

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

  private async getTopicIdsByTag(tagId: number) {
    const topicIds = await this.db
      .select({ topicId: this.forumTopicTag.topicId })
      .from(this.forumTopicTag)
      .where(eq(this.forumTopicTag.tagId, tagId))

    return [...new Set(topicIds.map((item) => item.topicId))]
  }

  private async mapTopicResults(
    topics: ForumTopic[],
    keyword: string,
  ): Promise<ForumSearchResultItem[]> {
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
  ): Promise<ForumSearchResultItem[]> {
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
        commentContentSnippet: this.buildSnippet(comment.commentContent, keyword),
        createdAt: comment.createdAt,
        commentCount: comment.commentCount,
        viewCount: comment.viewCount,
        likeCount: comment.likeCount,
        favoriteCount: comment.favoriteCount,
      }
    })
  }

  private async searchInternal(
    searchInput: ForumSearchInput,
    options: {
      publicOnly: boolean
      userId?: number
    },
  ): Promise<ForumSearchPageResult> {
    const type = searchInput.type ?? ForumSearchTypeEnum.ALL

    if (type === ForumSearchTypeEnum.TOPIC) {
      return this.searchTopics(searchInput, options)
    }

    if (type === ForumSearchTypeEnum.COMMENT) {
      return this.searchComments(searchInput, options)
    }

    const pageQuery = this.drizzle.buildPageQuery(searchInput)
    const mergedWindowSize = pageQuery.offset + pageQuery.pageSize

    const [topicResults, commentResults] = await Promise.all([
      this.searchTopics(
        {
          ...searchInput,
          type: ForumSearchTypeEnum.TOPIC,
          pageIndex: 0,
          pageSize: mergedWindowSize,
        },
        options,
      ),
      this.searchComments(
        {
          ...searchInput,
          type: ForumSearchTypeEnum.COMMENT,
          pageIndex: 0,
          pageSize: mergedWindowSize,
        },
        options,
      ),
    ])

    const mergedList = [...topicResults.list, ...commentResults.list]
      .sort((left, right) => this.compareResults(left, right, searchInput.sort))
      .slice(pageQuery.offset, pageQuery.offset + pageQuery.pageSize)

    return {
      list: mergedList,
      total: topicResults.total + commentResults.total,
      pageIndex: pageQuery.pageIndex,
      pageSize: pageQuery.pageSize,
    }
  }

  /**
   * 搜索
   * 根据搜索类型分发至主题/评论搜索，或合并结果
   * @param dto 搜索参数
   * @returns 搜索结果
   */
  private async searchTopics(
    dto: ForumSearchInput,
    options: {
      publicOnly: boolean
      userId?: number
    },
  ): Promise<ForumSearchPageResult> {
    const sectionIds = await this.resolveSectionScope(dto.sectionId, options)
    if (sectionIds && sectionIds.length === 0) {
      return this.createEmptyPage(dto)
    }

    const conditions = [
      isNull(this.forumTopic.deletedAt),
      or(
        ilike(this.forumTopic.title, `%${dto.keyword}%`),
        ilike(this.forumTopic.content, `%${dto.keyword}%`),
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
    ].filter(Boolean)

    if (dto.tagId) {
      const ids = await this.getTopicIdsByTag(dto.tagId)
      conditions.push(ids.length ? inArray(this.forumTopic.id, ids) : eq(this.forumTopic.id, -1))
    }

    const page = await this.drizzle.ext.findPagination(this.forumTopic, {
      where: and(...(conditions as [any, ...any[]])),
      ...dto,
      orderBy: this.getTopicOrderBy(dto.sort),
    })

    return {
      ...page,
      list: await this.mapTopicResults(page.list, dto.keyword),
    }
  }

  /**
   * 搜索评论
   * 支持按关键词与排序方式筛选
   * @param dto 搜索参数
   * @returns 评论搜索结果
   */
  private async searchComments(
    dto: ForumSearchInput,
    options: {
      publicOnly: boolean
      userId?: number
    },
  ): Promise<ForumSearchPageResult> {
    const sectionIds = await this.resolveSectionScope(dto.sectionId, options)
    if (sectionIds && sectionIds.length === 0) {
      return this.createEmptyPage(dto)
    }

    const topicIdsByTag = dto.tagId ? await this.getTopicIdsByTag(dto.tagId) : undefined
    if (topicIdsByTag && topicIdsByTag.length === 0) {
      return this.createEmptyPage(dto)
    }

    const pageQuery = this.drizzle.buildPageQuery(dto)
    const conditions = [
      eq(this.userComment.targetType, CommentTargetTypeEnum.FORUM_TOPIC),
      isNull(this.userComment.deletedAt),
      ilike(this.userComment.content, `%${dto.keyword}%`),
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
      topicIdsByTag
        ? inArray(this.forumTopic.id, topicIdsByTag)
        : undefined,
    ].filter(Boolean)

    const where = and(...(conditions as [any, ...any[]]))

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
        .innerJoin(this.forumTopic, eq(this.userComment.targetId, this.forumTopic.id))
        .where(where)
        .orderBy(...this.getCommentOrderBy(dto.sort))
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(this.userComment)
        .innerJoin(this.forumTopic, eq(this.userComment.targetId, this.forumTopic.id))
        .where(where),
    ])

    return {
      list: await this.mapCommentResults(rows, dto.keyword),
      total: totalRows[0]?.total ?? 0,
      pageIndex: pageQuery.pageIndex,
      pageSize: pageQuery.pageSize,
    }
  }
}

