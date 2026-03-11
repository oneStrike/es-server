import { BaseService } from '@libs/base/database'
import {
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import { BadRequestException, Injectable } from '@nestjs/common'
import { FavoriteGrowthService } from './favorite-growth.service'
import { FavoriteTargetTypeEnum } from './favorite.constant'

/**
 * 收藏服务
 * 提供收藏、取消收藏、查询收藏状态等核心业务逻辑
 */
@Injectable()
export class FavoriteService extends BaseService {
  /** 用户收藏 Prisma 代理 */
  get userFavorite() {
    return this.prisma.userFavorite
  }

  constructor(
    private readonly favoriteGrowthService: FavoriteGrowthService,
    private readonly messageOutboxService: MessageOutboxService,
  ) {
    super()
  }

  private async ensureTargetExists(
    tx: any,
    targetType: FavoriteTargetTypeEnum,
    targetId: number,
  ) {
    if (targetType === FavoriteTargetTypeEnum.FORUM_TOPIC) {
      const topic = await tx.forumTopic.findFirst({
        where: {
          id: targetId,
          deletedAt: null,
        },
        select: { userId: true },
      })

      if (!topic) {
        throw new BadRequestException('帖子不存在')
      }

      return { topicOwnerId: topic.userId }
    }

    const work = await tx.work.findFirst({
      where: {
        id: targetId,
        type: targetType,
        deletedAt: null,
      },
      select: { id: true },
    })

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    return {}
  }

  private async applyFavoriteCountDelta(
    tx: any,
    targetType: FavoriteTargetTypeEnum,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    if (targetType === FavoriteTargetTypeEnum.FORUM_TOPIC) {
      await tx.forumTopic.applyCountDelta(
        {
          id: targetId,
          deletedAt: null,
        },
        'favoriteCount',
        delta,
      )
      return
    }

    await tx.work.applyCountDelta(
      {
        id: targetId,
        type: targetType,
        deletedAt: null,
      },
      'favoriteCount',
      delta,
    )
  }

  /**
   * 批量检查收藏状态
   * @param targetType 目标类型
   * @param targetIds 目标 ID 列表
   * @param userId 用户 ID
   * @returns 目标 ID 与收藏状态的映射
   */
  async checkStatusBatch(
    targetType: FavoriteTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ) {
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

  /**
   * 收藏目标
   * @param targetType 目标类型
   * @param targetId 目标 ID
   * @param userId 用户 ID
   */
  async favorite(
    targetType: FavoriteTargetTypeEnum,
    targetId: number,
    userId: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const { topicOwnerId } = await this.ensureTargetExists(
        tx,
        targetType,
        targetId,
      )

      try {
        await tx.userFavorite.create({
          data: {
            targetType,
            targetId,
            user: {
              connect: {
                id: userId,
              },
            },
          },
        })
      } catch (error) {
        // 唯一键冲突：已收藏
        this.handlePrismaBusinessError(error, {
          duplicateMessage: '无法重复收藏',
          notFoundMessage: '用户不存在',
        })
      }

      await this.applyFavoriteCountDelta(tx, targetType, targetId, 1)

      if (targetType === FavoriteTargetTypeEnum.FORUM_TOPIC) {
        if (topicOwnerId !== undefined && topicOwnerId !== userId) {
          await this.messageOutboxService.enqueueNotificationEvent(
            {
              eventType: MessageNotificationTypeEnum.CONTENT_FAVORITE,
              bizKey: `notify:favorite:${targetType}:${targetId}:actor:${userId}:receiver:${topicOwnerId}`,
              payload: {
                receiverUserId: topicOwnerId,
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
      }

      await this.favoriteGrowthService.rewardFavoriteCreated(
        tx,
        targetType,
        targetId,
        userId,
      )
    })
  }

  /**
   * 取消收藏
   * @param targetType 目标类型
   * @param targetId 目标 ID
   * @param userId 用户 ID
   */
  async unfavorite(
    targetType: FavoriteTargetTypeEnum,
    targetId: number,
    userId: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.userFavorite.delete({
          where: {
            targetType_targetId_userId: {
              targetId,
              targetType,
              userId,
            },
          },
        })
      } catch (error) {
        this.handlePrismaBusinessError(error, {
          notFoundMessage: '收藏记录或用户不存在',
        })
      }

      await this.applyFavoriteCountDelta(tx, targetType, targetId, -1)
    })
  }

  /**
   * 检查单个目标收藏状态
   * @param targetType 目标类型
   * @param targetId 目标 ID
   * @param userId 用户 ID
   * @returns 是否已收藏
   */
  async checkFavoriteStatus(
    targetType: FavoriteTargetTypeEnum,
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

  /**
   * 获取用户收藏列表
   * @param userId 用户 ID
   * @param targetType 目标类型（可选）
   * @param pageIndex 页码
   * @param pageSize 每页数量
   * @returns 分页收藏列表
   */
  async getUserFavorites(
    userId: number,
    targetType?: FavoriteTargetTypeEnum,
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
}
