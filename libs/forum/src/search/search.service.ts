import {
  ForumReplyWhereInput,
  ForumTopicWhereInput,
  BaseService,
} from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { SearchDto, SearchReplyDto, SearchTopicDto } from './dto/search.dto'
import { SearchSortTypeEnum, SearchTypeEnum } from './search.constant'

/**
 * 搜索服务
 */
@Injectable()
export class SearchService extends BaseService {
  constructor() {
    super()
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumReply() {
    return this.prisma.forumReply
  }

  /**
   * 搜索
   * @param searchDto 搜索参数
   * @returns 搜索结果
   */
  async search(searchDto: SearchDto) {
    const {
      type = SearchTypeEnum.ALL,
      pageIndex = 0,
      pageSize = 15,
    } = searchDto

    if (type === SearchTypeEnum.TOPIC) {
      return this.searchTopics(searchDto)
    }

    if (type === SearchTypeEnum.REPLY) {
      return this.searchReplies(searchDto)
    }

    const topicPageSize = Math.ceil(pageSize / 2)
    const replyPageSize = Math.floor(pageSize / 2)

    const [topicResults, replyResults] = await Promise.all([
      this.searchTopics({ ...searchDto, pageSize: topicPageSize }),
      this.searchReplies({ ...searchDto, pageSize: replyPageSize }),
    ])

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
   * @param dto 搜索参数
   * @returns 主题搜索结果
   */
  private async searchTopics(dto: SearchTopicDto) {
    const where: ForumTopicWhereInput = {
      deletedAt: null,
      OR: [
        { title: { contains: dto.keyword } },
        { content: { contains: dto.keyword } },
      ],
    }

    if (dto.sectionId) {
      where.sectionId = dto.sectionId
    }

    if (dto.tagId) {
      where.topicTags = {
        some: {
          tagId: dto.tagId,
        },
      }
    }

    const orderBy = this.getOrderBy(dto.sort)

    return this.forumTopic.findPagination({
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
    })
  }

  /**
   * 搜索回复
   * @param dto 搜索参数
   * @returns 回复搜索结果
   */
  private async searchReplies(dto: SearchReplyDto) {
    const where: ForumReplyWhereInput = {
      deletedAt: null,
      content: {
        contains: dto.keyword,
      },
    }

    if (dto.sectionId) {
      where.topic = {
        sectionId: dto.sectionId,
      }
    }

    if (dto.tagId) {
      where.topic = {
        topicTags: {
          some: {
            tagId: dto.tagId,
          },
        },
      }
    }

    const orderBy = this.getOrderBy(dto.sort)

    return this.forumReply.findPagination({
      where,
      include: {
        topic: {
          select: {
            id: true,
            title: true,
            content: true,
            sectionId: true,
            viewCount: true,
            replyCount: true,
            likeCount: true,
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
    })
  }

  /**
   * 获取排序条件
   * @param sort 排序类型
   * @returns 排序条件
   */
  private getOrderBy(sort?: SearchSortTypeEnum) {
    switch (sort) {
      case SearchSortTypeEnum.HOT:
        return [
          { replyCount: 'desc' as const },
          { likeCount: 'desc' as const },
          { viewCount: 'desc' as const },
          { createdAt: 'desc' as const },
        ]
      case SearchSortTypeEnum.LATEST:
      case SearchSortTypeEnum.RELEVANCE:
      case undefined:
        return { createdAt: 'desc' as const }
    }
  }
}
