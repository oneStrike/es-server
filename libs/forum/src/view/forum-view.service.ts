import { RepositoryService } from '@libs/base/database'

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CreateForumViewDto, QueryForumViewDto, ViewStatisticsDto } from './dto/forum-view.dto'
import { ForumViewTypeEnum } from './forum-view.constant'

/**
 * 论坛浏览记录服务类
 * 提供论坛浏览记录的创建、查询、统计等核心业务逻辑
 */
@Injectable()
export class ForumViewService extends RepositoryService {
  get forumView() {
    return this.prisma.forumView
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumReply() {
    return this.prisma.forumReply
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

  async createForumView(createForumViewDto: CreateForumViewDto) {
    const { topicId, replyId, profileId, type, ...viewData } = createForumViewDto

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    if (type === ForumViewTypeEnum.REPLY && replyId) {
      const reply = await this.forumReply.findUnique({
        where: { id: replyId },
      })

      if (!reply) {
        throw new NotFoundException('回复不存在')
      }

      if (reply.topicId !== topicId) {
        throw new BadRequestException('回复不属于该主题')
      }
    }

    const profile = await this.forumProfile.findUnique({
      where: { id: profileId },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }

    const view = await this.forumView.create({
      data: {
        ...viewData,
        topicId,
        replyId,
        userId: profileId,
        type,
      },
    })

    if (type === ForumViewTypeEnum.TOPIC) {
      await this.forumTopic.update({
        where: { id: topicId },
        data: {
          viewCount: {
            increment: 1,
          },
        },
      })
    }

    return view
  }

  async getForumViews(queryForumViewDto: QueryForumViewDto) {
    const { topicId, profileId, type, ipAddress, pageIndex = 0, pageSize = 15 } = queryForumViewDto

    const where: any = {}

    if (topicId) {
      where.topicId = topicId
    }

    if (profileId) {
      where.userId = profileId
    }

    if (type) {
      where.type = type
    }

    if (ipAddress) {
      where.ipAddress = ipAddress
    }

    return this.forumView.findPagination({
      where,
      include: {
        topic: {
          select: {
            id: true,
            title: true,
          },
        },
        profile: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
      orderBy: {
        viewedAt: 'desc',
      },
      pageIndex,
      pageSize,
    })
  }

  async getViewStatistics(viewStatisticsDto: ViewStatisticsDto) {
    const { topicId } = viewStatisticsDto

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const totalViews = await this.forumView.count({
      where: {
        topicId,
      },
    })

    const uniqueViewers = await this.forumView.groupBy({
      by: ['userId'],
      where: {
        topicId,
      },
    })

    const viewsByType = await this.forumView.groupBy({
      by: ['type'],
      where: {
        topicId,
      },
      _count: {
        type: true,
      },
    })

    const recentViews = await this.forumView.findMany({
      where: {
        topicId,
      },
      include: {
        profile: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
      orderBy: {
        viewedAt: 'desc',
      },
      take: 10,
    })

    return {
      totalViews,
      uniqueViewers: uniqueViewers.length,
      viewsByType: viewsByType.reduce((acc, item) => {
        if (item.type) {
          acc[item.type] = item._count.type
        }
        return acc
      }, {} as Record<string, number>),
      recentViews,
    }
  }

  async getUserViewHistory(profileId: number, pageIndex = 0, pageSize = 15) {
    return this.forumView.findPagination({
      where: {
        userId: profileId,
      },
      include: {
        topic: {
          select: {
            id: true,
            title: true,
            sectionId: true,
          },
        },
      },
      orderBy: {
        viewedAt: 'desc',
      },
      pageIndex,
      pageSize,
    })
  }

  async deleteForumView(id: number) {
    const view = await this.forumView.findUnique({
      where: { id },
    })

    if (!view) {
      throw new NotFoundException('浏览记录不存在')
    }

    await this.forumView.delete({
      where: { id },
    })

    return { success: true }
  }

  async clearOldViews(daysOld: number = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await this.forumView.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    })

    return {
      deletedCount: result.count,
    }
  }
}
