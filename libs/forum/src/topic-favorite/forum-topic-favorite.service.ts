import { BaseService } from '@libs/base/database'

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CreateForumTopicFavoriteDto, QueryForumTopicFavoriteDto, ToggleTopicFavoriteDto } from './dto/forum-topic-favorite.dto'

@Injectable()
export class ForumTopicFavoriteService extends BaseService {
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
        topicId_userId: {
          topicId,
          userId: profileId,
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
          userId: profileId,
        },
      })

      await tx.forumTopic.update({
        where: { id: topicId },
        data: {
          favoriteCount: {
            increment: 1,
          },
        },
      })

      return favorite
    })
  }

  async removeFavorite(topicId: number, profileId: number) {
    const favorite = await this.forumTopicFavorite.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId: profileId,
        },
      },
    })

    if (!favorite) {
      throw new BadRequestException('收藏记录不存在')
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.forumTopic.update({
        where: { id: topicId },
        data: {
          favoriteCount: {
            decrement: 1,
          },
        },
      })

      return tx.forumTopicFavorite.delete({
        where: {
          topicId_userId: {
            topicId,
            userId: profileId,
          },
        },
      })
    })
  }

  async toggleTopicFavorite(toggleTopicFavoriteDto: ToggleTopicFavoriteDto) {
    const { topicId, profileId } = toggleTopicFavoriteDto

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
          userId: profileId,
        },
      },
    })

    if (existingFavorite) {
      return this.removeFavorite(topicId, profileId)
    } else {
      return this.addFavorite({ topicId, profileId })
    }
  }

  async getUserFavorites(queryForumTopicFavoriteDto: QueryForumTopicFavoriteDto) {
    const { profileId, pageIndex = 0, pageSize = 15 } = queryForumTopicFavoriteDto

    const where: any = {}

    if (profileId) {
      where.userId = profileId
    }

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
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      pageIndex,
      pageSize,
    })
  }

  async checkUserFavorited(topicId: number, profileId: number) {
    const favorite = await this.forumTopicFavorite.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId: profileId,
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
