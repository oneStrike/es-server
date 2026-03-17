import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, ilike, inArray, isNull, or } from 'drizzle-orm'
import {
  ForumSearchDto,
  ForumSearchReplyDto,
  ForumSearchTopicDto,
} from './dto/search.dto'
import { ForumSearchSortTypeEnum, ForumSearchTypeEnum } from './search.constant'

/**
 * 论坛搜索服务类
 * 支持主题与回复的关键词检索及混合搜索
 */
@Injectable()
export class ForumSearchService {
  constructor(private readonly drizzle: DrizzleService) {}

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
   * 获取回复模型
   */
  get userComment() {
    return this.drizzle.schema.userComment
  }

  get forumTopicTag() {
    return this.drizzle.schema.forumTopicTag
  }

  /**
   * 搜索
   * 根据搜索类型分发至主题/回复搜索，或合并结果
   * @param searchDto 搜索参数
   * @returns 搜索结果
   */
  async search(searchDto: ForumSearchDto) {
    const {
      type = ForumSearchTypeEnum.ALL,
      pageIndex = 1,
      pageSize = 15,
    } = searchDto

    if (type === ForumSearchTypeEnum.TOPIC) {
      return this.searchTopics(searchDto)
    }

    if (type === ForumSearchTypeEnum.REPLY) {
      return this.searchReplies(searchDto)
    }

    // 混合搜索时按比例拆分主题与回复数量
    const topicPageSize = Math.ceil(pageSize / 2)
    const replyPageSize = Math.floor(pageSize / 2)

    const [topicResults, replyResults] = await Promise.all([
      this.searchTopics({ ...searchDto, pageSize: topicPageSize }),
      this.searchReplies({ ...searchDto, pageSize: replyPageSize }),
    ])

    // 合并不同类型的搜索结果
    const results = [...topicResults.list, ...replyResults.list]
    const total = topicResults.total + replyResults.total

    return {
      list: results,
      total,
      pageIndex,
      pageSize,
    }
  }

  /**
   * 搜索主题
   * 支持按关键词与排序方式筛选
   * @param dto 搜索参数
   * @returns 主题搜索结果
   */
  private async searchTopics(dto: ForumSearchTopicDto) {
    const conditions = [
      isNull(this.forumTopic.deletedAt),
      dto.sectionId ? eq(this.forumTopic.sectionId, dto.sectionId) : undefined,
      or(
        ilike(this.forumTopic.title, `%${dto.keyword}%`),
        ilike(this.forumTopic.content, `%${dto.keyword}%`),
      ),
    ].filter(Boolean)

    if (dto.tagId) {
      const topicIds = await this.db
        .select({ topicId: this.forumTopicTag.topicId })
        .from(this.forumTopicTag)
        .where(eq(this.forumTopicTag.tagId, dto.tagId))
      const ids = topicIds.map((item) => item.topicId)
      conditions.push(ids.length ? inArray(this.forumTopic.id, ids) : eq(this.forumTopic.id, -1))
    }

    return this.drizzle.ext.findPagination(this.forumTopic, {
      where: and(...(conditions as [any, ...any[]])),
      ...dto,
      orderBy: this.getTopicOrderBy(dto.sort),
    })
  }

  /**
   * 搜索回复
   * 支持按关键词与排序方式筛选
   * @param dto 搜索参数
   * @returns 回复搜索结果
   */
  private async searchReplies(dto: ForumSearchReplyDto) {
    return this.drizzle.ext.findPagination(this.userComment, {
      where: and(
        isNull(this.userComment.deletedAt),
        ilike(this.userComment.content, `%${dto.keyword}%`),
      ),
      ...dto,
      orderBy: this.getTopicOrderBy(dto.sort),
    })
  }

  /**
   * 获取排序条件
   * @param sort 排序类型
   * @returns 排序条件
   */
  private getTopicOrderBy(sort?: ForumSearchSortTypeEnum) {
    const defaultOrder: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' }
    if (sort === ForumSearchSortTypeEnum.HOT) {
      return {
        replyCount: 'desc' as const,
        likeCount: 'desc' as const,
        viewCount: 'desc' as const,
        createdAt: 'desc' as const,
      }
    }
    return defaultOrder
  }
}
