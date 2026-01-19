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

  get forumProfile() {
    return this.prisma.forumProfile
  }

  async addFavorite(createForumTopicFavoriteDto: CreateForumTopicFavoriteDto) {
    const { topicId, profileId } = createForumTopicFavoriteDto

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

    const existingFavorite = await this.forumTopicFavorite.findUnique({
      where: {
        topicId_profileId: {
          topicId,
          profileId,
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
          profileId,
        },
      })

      await this.forumCounterService.updateTopicFavoriteRelatedCounts(
        tx,
        topicId,
        topic.profileId,
        1,
      )

      await this.actionLogService.createActionLog({
        profileId,
        actionType: ForumUserActionTypeEnum.FAVORITE_TOPIC,
        targetType: ForumUserActionTargetTypeEnum.TOPIC,
        targetId: topicId,
      })

      return favorite
    })
  }

  async removeFavorite(topicId: number, profileId: number) {
    const favorite = await this.forumTopicFavorite.findUnique({
      where: {
        topicId_profileId: {
          topicId,
          profileId,
        },
      },
    })

    if (!favorite) {
      throw new BadRequestException('收藏记录不存在')
    }

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId },
      select: { profileId: true },
    })

    if (!topic) {
      throw new BadRequestException('主题不存在')
    }

    return this.prisma.$transaction(async (tx) => {
      await this.forumCounterService.updateTopicFavoriteRelatedCounts(
        tx,
        topicId,
        topic.profileId,
        -1,
      )

      await this.actionLogService.createActionLog({
        profileId,
        actionType: ForumUserActionTypeEnum.UNFAVORITE_TOPIC,
        targetType: ForumUserActionTargetTypeEnum.TOPIC,
        targetId: topicId,
      })

      return tx.forumTopicFavorite.delete({
        where: {
          topicId_profileId: {
            topicId,
            profileId,
          },
        },
      })
    })
  }

  async toggleTopicFavorite(
    toggleTopicFavoriteDto: ToggleForumTopicFavoriteDto,
  ) {
    const { topicId, profileId } = toggleTopicFavoriteDto

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const existingFavorite = await this.forumTopicFavorite.findUnique({
      where: {
        topicId_profileId: {
          topicId,
          profileId,
        },
      },
    })

    if (existingFavorite) {
      return this.removeFavorite(topicId, profileId)
    } else {
      return this.addFavorite({ topicId, profileId })
    }
  }

  async getUserFavorites(
    queryForumTopicFavoriteDto: QueryForumTopicFavoriteDto,
  ) {
    const {
      profileId,
      pageIndex = 0,
      pageSize = 15,
    } = queryForumTopicFavoriteDto

    const where: any = {}

    if (profileId) {
      where.profileId = profileId
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
            profile: {
              select: {
                id: true,
                user: {
                  select: {
                    nickname: true,
                  },
                },
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

  async checkUserFavorited(topicId: number, profileId: number) {
    const favorite = await this.forumTopicFavorite.findUnique({
      where: {
        topicId_profileId: {
          topicId,
          profileId,
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
