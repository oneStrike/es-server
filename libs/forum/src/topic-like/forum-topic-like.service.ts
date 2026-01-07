import { RepositoryService } from '@libs/base/database'

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CreateForumTopicLikeDto, QueryForumTopicLikeDto, ToggleTopicLikeDto } from './dto/forum-topic-like.dto'

@Injectable()
export class ForumTopicLikeService extends RepositoryService {
  get forumTopicLike() {
    return this.prisma.forumTopicLike
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

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

      await tx.forumTopic.update({
        where: { id: topicId },
        data: {
          likeCount: {
            increment: 1,
          },
        },
      })

      return like
    })
  }

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

    return this.prisma.$transaction(async (tx) => {
      await tx.forumTopic.update({
        where: { id: topicId },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      })

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

  async toggleTopicLike(toggleTopicLikeDto: ToggleTopicLikeDto) {
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

  async getTopicLikes(queryForumTopicLikeDto: QueryForumTopicLikeDto) {
    const { topicId, profileId, pageIndex = 0, pageSize = 15 } = queryForumTopicLikeDto

    const where: any = {}

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
      orderBy: {
        createdAt: 'desc',
      },
      pageIndex,
      pageSize,
    })
  }

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
