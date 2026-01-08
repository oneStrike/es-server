import { RepositoryService } from '@libs/base/database'

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CreateForumReplyLikeDto, DeleteForumReplyLikeDto } from './dto/forum-reply-like.dto'

/**
 * 论坛回复点赞服务类
 * 提供论坛回复点赞的创建、删除等核心业务逻辑
 */
@Injectable()
export class ForumReplyLikeService extends RepositoryService {
  /**
   * 获取论坛回复点赞模型
   * @returns 论坛回复点赞模型
   */
  get forumReplyLike() {
    return this.prisma.forumReplyLike
  }

  /**
   * 获取论坛回复模型
   * @returns 论坛回复模型
   */
  get forumReply() {
    return this.prisma.forumReply
  }

  /**
   * 获取论坛用户资料模型
   * @returns 论坛用户资料模型
   */
  get forumProfile() {
    return this.prisma.forumProfile
  }

  /**
   * 点赞回复
   * @param createForumReplyLikeDto - 创建点赞记录的数据传输对象
   * @returns 创建的点赞记录
   * @throws {BadRequestException} 回复不存在时抛出
   * @throws {BadRequestException} 用户资料不存在时抛出
   * @throws {BadRequestException} 已经点赞过该回复时抛出
   */
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

  /**
   * 取消点赞回复
   * @param deleteForumReplyLikeDto - 删除点赞记录的数据传输对象
   * @returns 被删除的点赞记录
   * @throws {BadRequestException} 点赞记录不存在时抛出
   * @throws {BadRequestException} 无权取消他人的点赞时抛出
   */
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

  /**
   * 检查用户是否已点赞回复
   * @param replyId - 回复ID
   * @param userId - 用户ID
   * @returns 包含点赞状态的对象
   */
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
