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
  CreateForumTopicLikeDto,
  QueryForumTopicLikeDto,
  ToggleForumTopicLikeDto,
} from './dto/forum-topic-like.dto'

/**
 * 论坛主题点赞服务类
 * 提供主题点赞、取消点赞、切换点赞状态、查询点赞记录等核心业务逻辑
 */
@Injectable()
export class ForumTopicLikeService extends BaseService {
  constructor(
    private readonly forumCounterService: ForumCounterService,
    private readonly actionLogService: ForumUserActionLogService,
    private readonly userGrowthEventService: UserGrowthEventService,
  ) {
    super()
  }

  /**
   * 获取论坛主题点赞模型
   */
  get forumTopicLike() {
    return this.prisma.forumTopicLike
  }

  /**
   * 获取论坛主题模型
   */
  get forumTopic() {
    return this.prisma.forumTopic
  }

  /**
   * 点赞主题
   * @param createForumTopicLikeDto - 创建点赞的DTO，包含主题ID和用户ID
   * @returns 创建的点赞记录
   * @throws NotFoundException 主题不存在
   * @throws BadRequestException 用户不存在、已经点赞过该主题
   */
  async likeTopic(createForumTopicLikeDto: CreateForumTopicLikeDto) {
    const { topicId, userId } = createForumTopicLikeDto

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

    const existingLike = await this.forumTopicLike.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId,
        },
      },
    })

    if (existingLike) {
      throw new BadRequestException('已经点赞过该主题')
    }

    const like = await this.prisma.$transaction(async (tx) => {
      const like = await tx.forumTopicLike.create({
        data: {
          topicId,
          userId,
        },
      })

      await this.forumCounterService.updateTopicLikeRelatedCounts(
        tx,
        topicId,
        topic.userId,
        1,
      )

      await this.actionLogService.createActionLog({
        userId,
        actionType: ForumUserActionTypeEnum.LIKE_TOPIC,
        targetType: ForumUserActionTargetTypeEnum.TOPIC,
        targetId: topicId,
      })

      return like
    })

    await this.userGrowthEventService.handleEvent({
      business: 'forum',
      eventKey: ForumGrowthEventKey.TopicLike,
      userId,
      targetId: topicId,
      occurredAt: new Date(),
    })

    return like
  }

  /**
   * 取消点赞主题
   * @param topicId - 主题ID
   * @param userId - 用户ID
   * @returns 删除的点赞记录
   * @throws BadRequestException 点赞记录不存在
   */
  async unlikeTopic(topicId: number, userId: number) {
    const like = await this.forumTopicLike.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId,
        },
      },
    })

    if (!like) {
      throw new BadRequestException('点赞记录不存在')
    }

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId },
      select: { userId: true },
    })

    if (!topic) {
      throw new BadRequestException('主题不存在')
    }

    // 计数更新与点赞记录删除保持一致
    return this.prisma.$transaction(async (tx) => {
      await this.forumCounterService.updateTopicLikeRelatedCounts(
        tx,
        topicId,
        topic.userId,
        -1,
      )

      await this.actionLogService.createActionLog({
        userId,
        actionType: ForumUserActionTypeEnum.UNLIKE_TOPIC,
        targetType: ForumUserActionTargetTypeEnum.TOPIC,
        targetId: topicId,
      })

      return tx.forumTopicLike.delete({
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
   * 切换主题点赞状态
   * @param toggleTopicLikeDto - 切换点赞的DTO，包含主题ID和用户ID
   * @returns 点赞或取消点赞的结果
   * @throws NotFoundException 主题不存在
   */
  async toggleTopicLike(toggleTopicLikeDto: ToggleForumTopicLikeDto) {
    const { topicId, userId } = toggleTopicLikeDto

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const existingLike = await this.forumTopicLike.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId,
        },
      },
    })

    // 已点赞则取消，否则新增
    if (existingLike) {
      return this.unlikeTopic(topicId, userId)
    } else {
      return this.likeTopic({ topicId, userId })
    }
  }

  /**
   * 获取主题点赞列表（分页）
   * @param queryForumTopicLikeDto - 查询参数，包含主题ID、用户ID等过滤条件
   * @returns 分页的点赞列表
   */
  async getTopicLikes(queryForumTopicLikeDto: QueryForumTopicLikeDto) {
    const { topicId, userId, ...otherDto } = queryForumTopicLikeDto

    const where: any = { ...otherDto }

    if (topicId) {
      where.topicId = topicId
    }

    if (userId) {
      where.userId = userId
    }

    return this.forumTopicLike.findPagination({
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
   * 检查用户是否点赞过指定主题
   * @param topicId - 主题ID
   * @param userId - 用户ID
   * @returns 是否点赞过该主题
   */
  async checkUserLiked(topicId: number, userId: number) {
    const like = await this.forumTopicLike.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId,
        },
      },
    })

    return {
      liked: !!like,
    }
  }
}
