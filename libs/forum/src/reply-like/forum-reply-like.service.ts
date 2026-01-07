import { RepositoryService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { CreateForumReplyLikeDto, DeleteForumReplyLikeDto } from './dto/forum-reply-like.dto'

@Injectable()
export class ForumReplyLikeService extends RepositoryService {
  get forumReplyLike() {
    return this.prisma.forumReplyLike
  }

  get forumReply() {
    return this.prisma.forumReply
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

  async likeReply(createForumReplyLikeDto: CreateForumReplyLikeDto) {
    const { replyId, userId } = createForumReplyLikeDto

    const reply = await this.forumReply.findUnique({
      where: { id: replyId },
    })

    if (!reply) {
      throw new BadRequestException('回复不存在')
    }

    const profile = await this.forumProfile.findUnique({
      where: { id: userId },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }

    const existingLike = await this.forumReplyLike.findUnique({
      where: {
        replyId_userId: {
          replyId,
          userId,
        },
      },
    })

    if (existingLike) {
      throw new BadRequestException('已经点赞过该回复')
    }

    return this.prisma.$transaction(async (tx) => {
      const like = await tx.forumReplyLike.create({
        data: {
          replyId,
          userId,
        },
      })

      await tx.forumReply.update({
        where: { id: replyId },
        data: {
          likeCount: {
            increment: 1,
          },
        },
      })

      return like
    })
  }

  async unlikeReply(deleteForumReplyLikeDto: DeleteForumReplyLikeDto) {
    const { id, userId } = deleteForumReplyLikeDto

    const like = await this.forumReplyLike.findUnique({
      where: { id },
    })

    if (!like) {
      throw new BadRequestException('点赞记录不存在')
    }

    if (like.userId !== userId) {
      throw new BadRequestException('无权取消他人的点赞')
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.forumReply.update({
        where: { id: like.replyId },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      })

      return tx.forumReplyLike.delete({
        where: { id },
      })
    })
  }

  async checkUserLiked(replyId: number, userId: number) {
    const like = await this.forumReplyLike.findUnique({
      where: {
        replyId_userId: {
          replyId,
          userId,
        },
      },
    })

    return {
      liked: !!like,
    }
  }
}
