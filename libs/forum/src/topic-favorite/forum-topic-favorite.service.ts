import { BaseService } from '@libs/base/database'

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
import {
  CreateForumTopicFavoriteDto,
  QueryForumTopicFavoriteDto,
  ToggleForumTopicFavoriteDto,
} from './dto/forum-topic-favorite.dto'

@Injectable()
export class ForumTopicFavoriteService extends BaseService {
  constructor(
    private readonly forumCounterService: ForumCounterService,
    private readonly actionLogService: ForumUserActionLogService,
  ) {
    super()
  }

  get forumTopicFavorite() {
    return this.prisma.forumTopicFavorite
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

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

    return this.prisma.$transaction(async (tx) => {
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
  }

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

    if (existingFavorite) {
      return this.removeFavorite(topicId, userId)
    } else {
      return this.addFavorite({ topicId, userId })
    }
  }

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
