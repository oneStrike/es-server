import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { CounterService } from '../counter/counter.service'
import { InteractionTargetType } from '../interaction.constant'
import { TargetValidatorRegistry } from '../validator/target-validator.registry'

@Injectable()
export class CommentService extends BaseService {
  constructor(
    private readonly counterService: CounterService,
    private readonly validatorRegistry: TargetValidatorRegistry,
  ) {
    super()
  }

  async createComment(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
    content: string,
    replyToId?: number,
  ): Promise<any> {
    const validator = this.validatorRegistry.getValidator(targetType)
    const result = await validator.validate(targetId)

    if (!result.valid) {
      throw new Error(result.message || '目标不存在')
    }

    const lastComment = await this.prisma.userComment.findFirst({
      where: {
        targetType,
        targetId,
        replyToId: null,
      },
      orderBy: { floor: 'desc' },
      select: { floor: true },
    })

    const floor = (lastComment?.floor ?? 0) + 1

    const comment = await this.prisma.$transaction(async (tx) => {
      const newComment = await tx.userComment.create({
        data: {
          targetType,
          targetId,
          userId,
          content,
          floor,
          replyToId: replyToId || null,
          actualReplyToId: replyToId || null,
          auditStatus: 1,
        },
      })

      await this.counterService.incrementCount(tx, targetType, targetId, 'commentCount')

      return newComment
    })

    return comment
  }

  async deleteComment(
    commentId: number,
    userId: number,
  ): Promise<void> {
    const comment = await this.prisma.userComment.findUnique({
      where: { id: commentId },
    })

    if (!comment || comment.userId !== userId) {
      throw new Error('评论不存在或无权限删除')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userComment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      })

      await this.counterService.decrementCount(
        tx,
        comment.targetType as InteractionTargetType,
        comment.targetId,
        'commentCount',
      )
    })
  }

  async getComments(
    targetType: InteractionTargetType,
    targetId: number,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ list: any[], total: number }> {
    const where = {
      targetType,
      targetId,
      replyToId: null,
      deletedAt: null,
    }

    const [comments, total] = await Promise.all([
      this.prisma.userComment.findMany({
        where,
        orderBy: { floor: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              replies: {
                where: { deletedAt: null },
              },
            },
          },
        },
      }),
      this.prisma.userComment.count({ where }),
    ])

    return { list: comments, total }
  }

  async getReplies(
    commentId: number,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ list: any[], total: number }> {
    const where = {
      actualReplyToId: commentId,
      deletedAt: null,
    }

    const [replies, total] = await Promise.all([
      this.prisma.userComment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  nickname: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.userComment.count({ where }),
    ])

    return { list: replies, total }
  }
}
