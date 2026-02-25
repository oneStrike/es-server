import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@libs/base/database'
import { CounterService } from '../counter/counter.service'

@Injectable()
export class CommentLikeService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly counterService: CounterService,
  ) {}

  /**
   * 点赞评论
   */
  async likeComment(commentId: number, userId: number): Promise<void> {
    const existing = await this.prisma.userCommentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    })

    if (existing) {
      throw new Error('已经点赞过该评论')
    }

    await this.prisma.userCommentLike.create({
      data: {
        commentId,
        userId,
      },
    })

    // 增加评论点赞数
    await this.prisma.userComment.update({
      where: { id: commentId },
      data: {
        likeCount: {
          increment: 1,
        },
      },
    })
  }

  /**
   * 取消点赞评论
   */
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
      throw new Error('尚未点赞该评论')
    }

    await this.prisma.userCommentLike.delete({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    })

    // 减少评论点赞数
    await this.prisma.userComment.update({
      where: { id: commentId },
      data: {
        likeCount: {
          decrement: 1,
        },
      },
    })
  }

  /**
   * 检查是否已点赞
   */
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

  /**
   * 批量检查点赞状态
   */
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
