import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import {
  BadRequestException,
  Injectable,
} from '@nestjs/common'
import { CounterService } from '../counter/counter.service'

@Injectable()
export class LikeService extends BaseService {
  constructor(
    private readonly counterService: CounterService,
    private readonly messageOutboxService: MessageOutboxService,
  ) {
    super()
  }

  async checkStatusBatch(
    targetType: InteractionTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ): Promise<Map<number, boolean>> {
    if (targetIds.length === 0) {
      return new Map()
    }

    const likes = await this.prisma.userLike.findMany({
      where: {
        targetType,
        targetId: { in: targetIds },
        userId,
      },
      select: {
        targetId: true,
      },
    })

    const likedSet = new Set(likes.map((l) => l.targetId))
    const statusMap = new Map<number, boolean>()

    for (const targetId of targetIds) {
      statusMap.set(targetId, likedSet.has(targetId))
    }

    return statusMap
  }

  async getTargetLikes(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    pageIndex: number = 1,
    pageSize: number = 20,
  ) {
    return this.prisma.userLike.findPagination({
      where: {
        targetType,
        targetId,
        pageIndex,
        pageSize,
      } as any,
      orderBy: { createdAt: 'desc' },
      select: {
        userId: true,
        createdAt: true,
      },
    })
  }

  async getLikeCount(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<number> {
    return this.counterService.getCount(targetType, targetId, 'likeCount')
  }

  async getLikeCounts(
    targetType: InteractionTargetTypeEnum,
    targetIds: number[],
  ): Promise<Map<number, number>> {
    return this.counterService.getCounts(targetType, targetIds, 'likeCount')
  }

  async like(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.counterService.ensureTargetExists(targetType, targetId)

    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.userLike.create({
          data: {
            targetType,
            targetId,
            userId,
          },
        })
      } catch (error) {
        if (this.counterService.isDuplicateError(error)) {
          throw new BadRequestException('已点赞')
        }
        throw error
      }

      await this.counterService.applyCountDelta(
        tx,
        targetType,
        targetId,
        'likeCount',
        1,
      )

      const receiverUserId = await this.resolveReceiverUserId(
        tx,
        targetType,
        targetId,
      )
      if (receiverUserId && receiverUserId !== userId) {
        await this.messageOutboxService.enqueueNotificationEvent(
          {
            eventType: MessageNotificationTypeEnum.COMMENT_LIKE,
            bizKey: `notify:like:${targetType}:${targetId}:actor:${userId}:receiver:${receiverUserId}`,
            payload: {
              receiverUserId,
              actorUserId: userId,
              type: MessageNotificationTypeEnum.COMMENT_LIKE,
              targetType,
              targetId,
              title: '你的内容收到了点赞',
              content: '有人点赞了你的内容',
            },
          },
          tx,
        )
      }
    })
  }

  async unlike(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.counterService.ensureTargetExists(targetType, targetId)

    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.userLike.delete({
          where: {
            targetType_targetId_userId: {
              targetType,
              targetId,
              userId,
            },
          },
        })
      } catch (error) {
        if (this.isRecordNotFound(error)) {
          throw new BadRequestException('未点赞')
        }
        throw error
      }

      await this.counterService.applyCountDelta(
        tx,
        targetType,
        targetId,
        'likeCount',
        -1,
      )
    })
  }

  async checkLikeStatus(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<boolean> {
    const like = await this.prisma.userLike.findUnique({
      where: {
        targetType_targetId_userId: {
          targetType,
          targetId,
          userId,
        },
      },
      select: { id: true },
    })
    return !!like
  }

  async getUserLikes(
    userId: number,
    targetType?: InteractionTargetTypeEnum,
    pageIndex: number = 0,
    pageSize: number = 15,
  ) {
    return this.prisma.userLike.findPagination({
      where: {
        userId,
        ...(targetType !== undefined && { targetType }),
        pageIndex,
        pageSize,
      } as any,
      orderBy: { createdAt: 'desc' },
      select: {
        targetId: true,
        targetType: true,
        createdAt: true,
      },
    })
  }

  private async resolveReceiverUserId(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    if (targetType === InteractionTargetTypeEnum.FORUM_TOPIC) {
      const topic = await tx.forumTopic.findUnique({
        where: { id: targetId },
        select: { userId: true },
      })
      return topic?.userId
    }
    return undefined
  }
}
