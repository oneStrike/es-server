import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'
import { FavoriteGrowthService } from './favorite-growth.service'
import { FavoriteInteractionService } from './favorite-interaction.service'
import { FavoritePermissionService } from './favorite-permission.service'

@Injectable()
export class FavoriteService extends BaseService {
  constructor(
    private readonly favoritePermissionService: FavoritePermissionService,
    private readonly favoriteInteractionService: FavoriteInteractionService,
    private readonly favoriteGrowthService: FavoriteGrowthService,
    private readonly interactionTargetAccessService: InteractionTargetAccessService,
  ) {
    super()
  }

  /**
   * Shared target counter update.
   * Delegates model/where resolution to InteractionTargetAccessService.
   */
  private async applyTargetCountDelta(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    field: string,
    delta: number,
  ) {
    await this.interactionTargetAccessService.applyTargetCountDelta(
      tx,
      targetType,
      targetId,
      field,
      delta,
    )
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
    await this.favoritePermissionService.ensureCanFavorite(
      userId,
      targetType,
      targetId,
    )

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

      await this.applyTargetCountDelta(
        tx,
        targetType,
        targetId,
        'favoriteCount',
        1,
      )

      await this.favoriteInteractionService.handleFavoriteCreated(tx, {
        targetType,
        targetId,
        userId,
      })
    })

    await this.favoriteGrowthService.rewardFavoriteCreated(
      targetType,
      targetId,
      userId,
    )
  }

  async unfavorite(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.favoritePermissionService.ensureCanUnfavorite(
      userId,
      targetType,
      targetId,
    )

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
          notFoundMessage: '收藏记录不存在',
        })
      }

      await this.applyTargetCountDelta(
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
}
