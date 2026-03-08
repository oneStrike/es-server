import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import { Injectable } from '@nestjs/common'
import { CounterService } from '../counter/counter.service'

@Injectable()
export class FavoriteService extends BaseService {
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

    const favorites = await this.prisma.userFavorite.findMany({
      where: {
        targetType,
        targetId: { in: targetIds },
        userId,
      },
      select: {
        targetId: true,
      },
    })

    const favoritedSet = new Set(favorites.map((f) => f.targetId))
    const statusMap = new Map<number, boolean>()

    for (const targetId of targetIds) {
      statusMap.set(targetId, favoritedSet.has(targetId))
    }

    return statusMap
  }

  async favorite(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.counterService.ensureTargetExists(targetType, targetId)

    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.userFavorite.create({
          data: {
            targetType,
            targetId,
            userId,
          },
        })
      } catch (error) {
        this.handlePrismaBusinessError(error, {
          duplicateMessage: '已收藏',
        })
      }

      await this.counterService.applyCountDelta(
        tx,
        targetType,
        targetId,
        'favoriteCount',
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
            eventType: MessageNotificationTypeEnum.CONTENT_FAVORITE,
            bizKey: `notify:favorite:${targetType}:${targetId}:actor:${userId}:receiver:${receiverUserId}`,
            payload: {
              receiverUserId,
              actorUserId: userId,
              type: MessageNotificationTypeEnum.CONTENT_FAVORITE,
              targetType,
              targetId,
              title: '你的内容被收藏了',
              content: '有人收藏了你的内容',
            },
          },
          tx,
        )
      }
    })
  }

  async unfavorite(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.counterService.ensureTargetExists(targetType, targetId)

    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.userFavorite.delete({
          where: {
            targetType_targetId_userId: {
              targetType,
              targetId,
              userId,
            },
          },
        })
      } catch (error) {
        this.handlePrismaBusinessError(error, {
          notFoundMessage: '未收藏',
        })
      }

      await this.counterService.applyCountDelta(
        tx,
        targetType,
        targetId,
        'favoriteCount',
        -1,
      )
    })
  }

  async checkFavoriteStatus(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<boolean> {
    const favorite = await this.prisma.userFavorite.findUnique({
      where: {
        targetType_targetId_userId: {
          targetType,
          targetId,
          userId,
        },
      },
      select: { id: true },
    })
    return !!favorite
  }

  async getUserFavorites(
    userId: number,
    targetType?: InteractionTargetTypeEnum,
    pageIndex: number = 0,
    pageSize: number = 15,
  ) {
    return this.prisma.userFavorite.findPagination({
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
