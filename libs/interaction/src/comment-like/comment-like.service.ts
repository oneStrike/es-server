import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

@Injectable()
export class CommentLikeService extends BaseService {
  async likeComment(commentId: number, userId: number): Promise<void> {
    const comment = await this.prisma.userComment.findUnique({
      where: { id: commentId, deletedAt: null },
      select: { id: true },
    })
    if (!comment) {
      throw new NotFoundException('评论不存在')
    }
    const existing = await this.prisma.userCommentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    })

    if (existing) {
      throw new BadRequestException('已经点赞过该评论')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userCommentLike.create({
        data: {
          commentId,
          userId,
        },
      })

      await tx.userComment.update({
        where: { id: commentId },
        data: {
          likeCount: {
            increment: 1,
          },
        },
      })
    })
  }

  async unlikeComment(commentId: number, userId: number): Promise<void> {
    const existing = await this.prisma.userCommentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    })

    if (!existing) {
      throw new BadRequestException('尚未点赞该评论')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userCommentLike.delete({
        where: {
          commentId_userId: {
            commentId,
            userId,
          },
        },
      })

      await tx.userComment.update({
        where: { id: commentId },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      })
    })
  }

  async checkLikeStatus(commentId: number, userId: number): Promise<boolean> {
    const like = await this.prisma.userCommentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    })
    return !!like
  }

  async checkLikeStatusBatch(
    commentIds: number[],
    userId: number,
  ): Promise<Map<number, boolean>> {
    if (commentIds.length === 0) {
      return new Map()
    }

    const likes = await this.prisma.userCommentLike.findMany({
      where: {
        commentId: { in: commentIds },
        userId,
      },
      select: {
        commentId: true,
      },
    })

    const likedSet = new Set(likes.map((l) => l.commentId))
    const statusMap = new Map<number, boolean>()

    for (const commentId of commentIds) {
      statusMap.set(commentId, likedSet.has(commentId))
    }

    return statusMap
  }
}
