import { BaseService } from '@libs/base/database'

import { UserGrowthEventService } from '@libs/user/growth-event'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ForumGrowthEventKey } from '../forum-growth-event.constant'
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
  constructor(
    private readonly userGrowthEventService: UserGrowthEventService,
  ) {
    super()
  }

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

  /**
   * 创建浏览记录
   * 支持主题与回复浏览，校验关联关系并触发成长事件
   * @param createForumViewDto 浏览记录数据
   * @returns 创建的浏览记录
   */
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

      await this.userGrowthEventService.handleEvent({
        business: 'forum',
        eventKey: ForumGrowthEventKey.TopicView,
        userId,
        targetId: topicId,
        ip: viewData.ipAddress,
        occurredAt: new Date(),
      })
    }

    return view
  }

  /**
   * 查询浏览记录
   * @param queryForumViewDto 查询条件
   * @returns 分页浏览记录
   */
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

  /**
   * 获取浏览统计
   * @param viewStatisticsDto 统计查询条件
   * @returns 浏览统计汇总
   */
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

    // 按用户去重统计浏览人数
    const uniqueViewers = await this.forumView.groupBy({
      by: ['userId'],
      where: {
        topicId,
      },
    })

    // 按浏览类型聚合次数
    const viewsByType = await this.forumView.groupBy({
      by: ['type'],
      where: {
        topicId,
      },
      _count: {
        type: true,
      },
    })

    // 最近浏览记录用于展示详情
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

  /**
   * 获取用户浏览历史
   * @param userId 用户ID
   * @returns 浏览历史列表
   */
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

  /**
   * 删除浏览记录
   * @param id 浏览记录ID
   * @returns 删除结果
   */
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

  /**
   * 清理过期浏览记录
   * @param daysOld 过期天数
   * @returns 清理结果
   */
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
