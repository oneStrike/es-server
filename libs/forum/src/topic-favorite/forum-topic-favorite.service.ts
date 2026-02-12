import { BaseService } from '@libs/base/database'

import { UserGrowthEventService } from '@libs/user/growth-event'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log/action-log.constant'
import { ForumUserActionLogService } from '../action-log/action-log.service'
import { ForumCounterService } from '../counter/forum-counter.service'
import { ForumGrowthEventKey } from '../forum-growth-event.constant'
import {
  CreateForumTopicFavoriteDto,
  QueryForumTopicFavoriteDto,
  ToggleForumTopicFavoriteDto,
} from './dto/forum-topic-favorite.dto'

/**
 * 论坛主题收藏服务类
 * 处理收藏/取消收藏、收藏列表与统计等业务逻辑
 */
@Injectable()
export class ForumTopicFavoriteService extends BaseService {
  constructor(
    private readonly forumCounterService: ForumCounterService,
    private readonly actionLogService: ForumUserActionLogService,
    private readonly userGrowthEventService: UserGrowthEventService,
  ) {
    super()
  }

  /**
   * 获取主题收藏模型
   */
  get forumTopicFavorite() {
    return this.prisma.forumTopicFavorite
  }

  /**
   * 获取主题模型
   */
  get forumTopic() {
    return this.prisma.forumTopic
  }

  /**
   * 收藏主题
   * 同步更新计数与操作日志，触发成长事件
   * @param createForumTopicFavoriteDto 收藏请求
   * @returns 收藏记录
   */
  async addFavorite(createForumTopicFavoriteDto: CreateForumTopicFavoriteDto) {
    const { topicId, userId } = createForumTopicFavoriteDto

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const existingFavorite = await this.forumTopicFavorite.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId,
        },
      },
    })

    if (existingFavorite) {
      throw new BadRequestException('已经收藏过该主题')
    }

    const favorite = await this.prisma.$transaction(async (tx) => {
      const favorite = await tx.forumTopicFavorite.create({
        data: {
          topicId,
          userId,
        },
      })

      await this.forumCounterService.updateTopicFavoriteRelatedCounts(
        tx,
        topicId,
        topic.userId,
        1,
      )

      await this.actionLogService.createActionLog({
        userId,
        actionType: ForumUserActionTypeEnum.FAVORITE_TOPIC,
        targetType: ForumUserActionTargetTypeEnum.TOPIC,
        targetId: topicId,
      })

      return favorite
    })

    await this.userGrowthEventService.handleEvent({
      business: 'forum',
      eventKey: ForumGrowthEventKey.TopicFavorite,
      userId,
      targetId: topicId,
      occurredAt: new Date(),
    })

    return favorite
  }

  /**
   * 取消收藏主题
   * 同步回滚计数与操作日志
   * @param topicId 主题ID
   * @param userId 用户ID
   * @returns 删除结果
   */
  async removeFavorite(topicId: number, userId: number) {
    const favorite = await this.forumTopicFavorite.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId,
        },
      },
    })

    if (!favorite) {
      throw new BadRequestException('收藏记录不存在')
    }

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId },
      select: { userId: true },
    })

    if (!topic) {
      throw new BadRequestException('主题不存在')
    }

    // 计数更新与收藏记录删除保持一致
    return this.prisma.$transaction(async (tx) => {
      await this.forumCounterService.updateTopicFavoriteRelatedCounts(
        tx,
        topicId,
        topic.userId,
        -1,
      )

      await this.actionLogService.createActionLog({
        userId,
        actionType: ForumUserActionTypeEnum.UNFAVORITE_TOPIC,
        targetType: ForumUserActionTargetTypeEnum.TOPIC,
        targetId: topicId,
      })

      return tx.forumTopicFavorite.delete({
        where: {
          topicId_userId: {
            topicId,
            userId,
          },
        },
      })
    })
  }

  /**
   * 切换收藏状态
   * @param toggleTopicFavoriteDto 切换收藏请求
   * @returns 收藏或取消收藏结果
   */
  async toggleTopicFavorite(
    toggleTopicFavoriteDto: ToggleForumTopicFavoriteDto,
  ) {
    const { topicId, userId } = toggleTopicFavoriteDto

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const existingFavorite = await this.forumTopicFavorite.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId,
        },
      },
    })

    // 已收藏则取消，否则新增
    if (existingFavorite) {
      return this.removeFavorite(topicId, userId)
    } else {
      return this.addFavorite({ topicId, userId })
    }
  }

  /**
   * 查询用户收藏列表
   * @param queryForumTopicFavoriteDto 查询参数
   * @returns 分页收藏列表
   */
  async getUserFavorites(
    queryForumTopicFavoriteDto: QueryForumTopicFavoriteDto,
  ) {
    const {
      userId,
      pageIndex = 0,
      pageSize = 15,
    } = queryForumTopicFavoriteDto

    const where: any = {}

    if (userId) {
      where.userId = userId
    }

    where.pageIndex = pageIndex
    where.pageSize = pageSize

    return this.forumTopicFavorite.findPagination({
      where,
      include: {
        topic: {
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            likeCount: true,
            replyCount: true,
            viewCount: true,
            favoriteCount: true,
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
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  /**
   * 检查是否收藏过主题
   * @param topicId 主题ID
   * @param userId 用户ID
   * @returns 收藏状态
   */
  async checkUserFavorited(topicId: number, userId: number) {
    const favorite = await this.forumTopicFavorite.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId,
        },
      },
    })

    return {
      favorited: !!favorite,
    }
  }

  /**
   * 获取主题收藏数
   * @param topicId 主题ID
   * @returns 收藏统计
   */
  async getTopicFavoriteCount(topicId: number) {
    const count = await this.forumTopicFavorite.count({
      where: {
        topicId,
      },
    })

    return {
      topicId,
      favoriteCount: count,
    }
  }
}
