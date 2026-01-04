import { PrismaService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import {
  SearchDto,
  SearchResultDto,
  SearchResultPageDto,
} from './dto/search.dto'
import {
  SearchSortTypeEnum,
  SearchTimeFilterEnum,
  SearchTypeEnum,
} from './search.constant'

/**
 * 搜索服务
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 搜索
   * @param searchDto 搜索参数
   * @returns 搜索结果
   */
  async search(searchDto: SearchDto): Promise<SearchResultPageDto> {
    const {
      keyword,
      type = SearchTypeEnum.ALL,
      sectionId,
      tagId,
      sort = SearchSortTypeEnum.RELEVANCE,
      timeFilter = SearchTimeFilterEnum.ALL,
      page = 1,
      pageSize = 20,
    } = searchDto

    const results: SearchResultDto[] = []

    if (type === SearchTypeEnum.TOPIC || type === SearchTypeEnum.ALL) {
      const topicResults = await this.searchTopics(
        keyword,
        sectionId,
        tagId,
        sort,
        timeFilter,
        page,
        pageSize,
      )
      results.push(...topicResults)
    }

    if (type === SearchTypeEnum.REPLY || type === SearchTypeEnum.ALL) {
      const replyResults = await this.searchReplies(
        keyword,
        sectionId,
        tagId,
        sort,
        timeFilter,
        page,
        pageSize,
      )
      results.push(...replyResults)
    }

    const total = results.length
    const paginatedResults = results.slice(
      (page - 1) * pageSize,
      page * pageSize,
    )

    return {
      list: paginatedResults,
      total,
      page,
      pageSize,
    }
  }

  /**
   * 搜索主题
   * @param keyword 关键词
   * @param sectionId 板块ID
   * @param tagId 标签ID
   * @param sort 排序类型
   * @param timeFilter 时间筛选
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 主题搜索结果
   */
  private async searchTopics(
    keyword: string,
    sectionId?: number,
    tagId?: number,
    sort?: SearchSortTypeEnum,
    timeFilter?: SearchTimeFilterEnum,
    page = 1,
    pageSize = 20,
  ): Promise<SearchResultDto[]> {
    const where: any = {
      deletedAt: null,
      OR: [
        { title: { contains: keyword } },
        { content: { contains: keyword } },
      ],
    }

    if (sectionId) {
      where.sectionId = sectionId
    }

    if (tagId) {
      where.tags = {
        some: {
          tagId,
        },
      }
    }

    if (timeFilter && timeFilter !== SearchTimeFilterEnum.ALL) {
      where.createdAt = this.getTimeFilter(timeFilter)
    }

    const orderBy = this.getOrderBy(sort)

    const topics = await this.prisma.forumTopic.findMany({
      where,
      include: {
        section: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            nickname: true,
          },
        },
        _count: {
          select: {
            replies: true,
            likes: true,
          },
        },
      },
      orderBy,
      take: pageSize,
      skip: (page - 1) * pageSize,
    })

    return topics.map((topic) => ({
      topicId: topic.id,
      topicTitle: topic.title,
      topicContent: topic.content,
      sectionId: topic.sectionId,
      sectionName: topic.section.name,
      userId: topic.userId,
      userNickname: topic.user.nickname,
      createdAt: topic.createdAt,
      replyCount: topic._count.replies,
      viewCount: topic.viewCount,
      likeCount: topic._count.likes,
    }))
  }

  /**
   * 搜索回复
   * @param keyword 关键词
   * @param sectionId 板块ID
   * @param tagId 标签ID
   * @param sort 排序类型
   * @param timeFilter 时间筛选
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 回复搜索结果
   */
  private async searchReplies(
    keyword: string,
    sectionId?: number,
    tagId?: number,
    sort?: SearchSortTypeEnum,
    timeFilter?: SearchTimeFilterEnum,
    page = 1,
    pageSize = 20,
  ): Promise<SearchResultDto[]> {
    const where: any = {
      deletedAt: null,
      content: {
        contains: keyword,
      },
    }

    if (sectionId) {
      where.topic = {
        sectionId,
      }
    }

    if (tagId) {
      where.topic = {
        tags: {
          some: {
            tagId,
          },
        },
      }
    }

    if (timeFilter && timeFilter !== SearchTimeFilterEnum.ALL) {
      where.createdAt = this.getTimeFilter(timeFilter)
    }

    const orderBy = this.getOrderBy(sort)

    const replies = await this.prisma.forumReply.findMany({
      where,
      include: {
        topic: {
          include: {
            section: {
              select: {
                id: true,
                name: true,
              },
            },
            user: {
              select: {
                id: true,
                nickname: true,
              },
            },
            _count: {
              select: {
                replies: true,
                likes: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
      orderBy,
      take: pageSize,
      skip: (page - 1) * pageSize,
    })

    return replies.map((reply) => ({
      topicId: reply.topicId,
      topicTitle: reply.topic.title,
      topicContent: reply.topic.content,
      sectionId: reply.topic.sectionId,
      sectionName: reply.topic.section.name,
      userId: reply.topic.userId,
      userNickname: reply.topic.user.nickname,
      replyId: reply.id,
      replyContent: reply.content,
      createdAt: reply.createdAt,
      replyCount: reply.topic._count.replies,
      viewCount: reply.topic.viewCount,
      likeCount: reply.topic._count.likes,
    }))
  }

  /**
   * 获取时间筛选条件
   * @param timeFilter 时间筛选
   * @returns 时间筛选条件
   */
  private getTimeFilter(timeFilter: SearchTimeFilterEnum): any {
    const now = new Date()
    let startDate: Date

    switch (timeFilter) {
      case SearchTimeFilterEnum.ONE_DAY:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case SearchTimeFilterEnum.ONE_WEEK:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case SearchTimeFilterEnum.ONE_MONTH:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case SearchTimeFilterEnum.ONE_YEAR:
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        return undefined
    }

    return {
      gte: startDate,
    }
  }

  /**
   * 获取排序条件
   * @param sort 排序类型
   * @returns 排序条件
   */
  private getOrderBy(sort?: SearchSortTypeEnum): any {
    switch (sort) {
      case SearchSortTypeEnum.LATEST:
        return { createdAt: 'desc' }
      case SearchSortTypeEnum.HOT:
        return { viewCount: 'desc' }
      case SearchSortTypeEnum.RELEVANCE:
      default:
        return { createdAt: 'desc' }
    }
  }
}
