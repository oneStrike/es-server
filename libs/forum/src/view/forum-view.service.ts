import { BaseService } from '@libs/base/database'

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  CreateForumViewDto,
  ForumViewStatisticsDto,
  QueryForumViewDto,
} from './dto/forum-view.dto'
import { ForumViewTypeEnum } from './forum-view.constant'

/**
 * 论坛浏览记录服务类
 * 提供论坛浏览记录的创建、查询、统计等核心业务逻辑
 */
@Injectable()
export class ForumViewService extends BaseService {
  get forumView() {
    return this.prisma.forumView
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumReply() {
    return this.prisma.forumReply
  }

  get appUser() {
    return this.prisma.appUser
  }

  // get forumProfile() {
  //   return this.prisma.forumProfile
  // }

  async createView(createForumViewDto: CreateForumViewDto) {
    const { topicId, replyId, userId, type, ...viewData } =
      createForumViewDto

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

    const user = await this.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const view = await this.forumView.create({
      data: {
        ...viewData,
        topicId,
        replyId,
        userId,
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
    const { topicId, userId, type, ipAddress, ...otherDto } =
      queryForumViewDto

    const where: any = { ...otherDto }

    if (topicId) {
      where.topicId = topicId
    }

    if (userId) {
      where.userId = userId
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
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    })
  }

  async getViewStatistics(viewStatisticsDto: ForumViewStatisticsDto) {
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
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
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
      viewsByType: viewsByType.reduce(
        (acc, item) => {
          if (item.type) {
            acc[item.type] = item._count.type
          }
          return acc
        },
        {} as Record<string, number>,
      ),
      recentViews,
    }
  }

  async getUserViewHistory(userId: number) {
    return this.forumView.findPagination({
      where: {
        userId,
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
        viewedAt: {
          lt: cutoffDate,
        },
      },
    })

    return {
      deletedCount: result.count,
    }
  }
}
