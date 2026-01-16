import { BaseService } from '@libs/base/database'

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ForumCounterService } from '../counter/forum-counter.service'
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
  constructor(private readonly forumCounterService: ForumCounterService) {
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
   * 获取论坛用户资料模型
   */
  get forumProfile() {
    return this.prisma.forumProfile
  }

  /**
   * 点赞主题
   * @param createForumTopicLikeDto - 创建点赞的DTO，包含主题ID和用户资料ID
   * @returns 创建的点赞记录
   * @throws NotFoundException 主题不存在
   * @throws BadRequestException 用户资料不存在、已经点赞过该主题
   */
  async likeTopic(createForumTopicLikeDto: CreateForumTopicLikeDto) {
    const { topicId, profileId } = createForumTopicLikeDto

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const profile = await this.forumProfile.findUnique({
      where: { id: profileId },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }

    const existingLike = await this.forumTopicLike.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId: profileId,
        },
      },
    })

    if (existingLike) {
      throw new BadRequestException('已经点赞过该主题')
    }

    return this.prisma.$transaction(async (tx) => {
      const like = await tx.forumTopicLike.create({
        data: {
          topicId,
          userId: profileId,
        },
      })

      await this.forumCounterService.updateTopicLikeRelatedCounts(
        tx,
        topicId,
        topic.profileId,
        1,
      )

      return like
    })
  }

  /**
   * 取消点赞主题
   * @param topicId - 主题ID
   * @param profileId - 用户资料ID
   * @returns 删除的点赞记录
   * @throws BadRequestException 点赞记录不存在
   */
  async unlikeTopic(topicId: number, profileId: number) {
    const like = await this.forumTopicLike.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId: profileId,
        },
      },
    })

    if (!like) {
      throw new BadRequestException('点赞记录不存在')
    }

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId },
      select: { profileId: true },
    })

    if (!topic) {
      throw new BadRequestException('主题不存在')
    }

    return this.prisma.$transaction(async (tx) => {
      await this.forumCounterService.updateTopicLikeRelatedCounts(
        tx,
        topicId,
        topic.profileId,
        -1,
      )

      return tx.forumTopicLike.delete({
        where: {
          topicId_userId: {
            topicId,
            userId: profileId,
          },
        },
      })
    })
  }

  /**
   * 切换主题点赞状态
   * @param toggleTopicLikeDto - 切换点赞的DTO，包含主题ID和用户资料ID
   * @returns 点赞或取消点赞的结果
   * @throws NotFoundException 主题不存在
   */
  async toggleTopicLike(toggleTopicLikeDto: ToggleForumTopicLikeDto) {
    const { topicId, profileId } = toggleTopicLikeDto

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
          userId: profileId,
        },
      },
    })

    if (existingLike) {
      return this.unlikeTopic(topicId, profileId)
    } else {
      return this.likeTopic({ topicId, profileId })
    }
  }

  /**
   * 获取主题点赞列表（分页）
   * @param queryForumTopicLikeDto - 查询参数，包含主题ID、用户资料ID等过滤条件
   * @returns 分页的点赞列表
   */
  async getTopicLikes(queryForumTopicLikeDto: QueryForumTopicLikeDto) {
    const { topicId, profileId, ...otherDto } = queryForumTopicLikeDto

    const where: any = { ...otherDto }

    if (topicId) {
      where.topicId = topicId
    }

    if (profileId) {
      where.userId = profileId
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
        profile: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    })
  }

  /**
   * 检查用户是否点赞过指定主题
   * @param topicId - 主题ID
   * @param profileId - 用户资料ID
   * @returns 是否点赞过该主题
   */
  async checkUserLiked(topicId: number, profileId: number) {
    const like = await this.forumTopicLike.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId: profileId,
        },
      },
    })

    return {
      liked: !!like,
    }
  }
}
