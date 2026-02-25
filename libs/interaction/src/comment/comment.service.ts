import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@libs/base/database'
import { CounterService } from '../counter/counter.service'
import { InteractionTargetType } from '../interaction.constant'
import { TargetValidatorRegistry } from '../validator/target-validator.registry'

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly counterService: CounterService,
    private readonly validatorRegistry: TargetValidatorRegistry,
  ) {}

  /**
   * 发表评论
   */
  async createComment(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
    content: string,
    replyToId?: number,
  ): Promise<any> {
    // 校验目标是否存在
    const validator = this.validatorRegistry.getValidator(targetType)
    const result = await validator.validate(targetId)

    if (!result.valid) {
      throw new Error(result.message || '目标不存在')
    }

    // 获取当前楼层号
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

    // 创建评论
    const comment = await this.prisma.userComment.create({
      data: {
        targetType,
        targetId,
        userId,
        content,
        floor,
        replyToId: replyToId || null,
        actualReplyToId: replyToId || null,
        auditStatus: 1, // 默认已通过
      },
    })

    // 增加评论计数
    await this.counterService.increment(targetType, targetId, 'commentCount')

    return comment
  }

  /**
   * 删除评论
   */
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

    // 软删除
    await this.prisma.userComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    })

    // 减少评论计数
    await this.counterService.decrement(
      comment.targetType as InteractionTargetType,
      comment.targetId,
      'commentCount',
    )
  }

  /**
   * 获取评论列表
   */
  async getComments(
    targetType: InteractionTargetType,
    targetId: number,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ list: any[]; total: number }> {
    const where: any = {
      targetType,
      targetId,
      replyToId: null,
      isHidden: false,
      deletedAt: null,
    }

    const [comments, total] = await Promise.all([
      this.prisma.userComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
              replies: true,
            },
          },
        },
      }),
      this.prisma.userComment.count({ where }),
    ])

    return { list: comments, total }
  }

  /**
   * 获取评论回复列表
   */
  async getReplies(
    commentId: number,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ list: any[]; total: number }> {
    const where: any = {
      actualReplyToId: commentId,
      isHidden: false,
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
