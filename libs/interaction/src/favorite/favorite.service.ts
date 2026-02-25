import { Injectable } from '@nestjs/common'
import { BaseInteractionService } from '../base-interaction.service'
import { CounterService } from '../counter/counter.service'
import { InteractionActionType, InteractionTargetType } from '../interaction.constant'
import { TargetValidatorRegistry } from '../validator/target-validator.registry'

@Injectable()
export class FavoriteService extends BaseInteractionService {
  constructor(
    protected readonly counterService: CounterService,
    protected readonly validatorRegistry: TargetValidatorRegistry,
  ) {
    super()
  }

  protected getActionType(): InteractionActionType {
    return InteractionActionType.FAVORITE
  }

  protected getCancelActionType(): InteractionActionType {
    return InteractionActionType.UNFAVORITE
  }

  protected async checkUserInteracted(
    targetType: InteractionTargetType,
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
    })
    return !!favorite
  }

  protected async createInteraction(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.prisma.userFavorite.create({
      data: {
        targetType,
        targetId,
        userId,
      },
    })
  }

  protected async deleteInteraction(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.prisma.userFavorite.delete({
      where: {
        targetType_targetId_userId: {
          targetType,
          targetId,
          userId,
        },
      },
    })
  }

  protected getCountField(): string {
    return 'favoriteCount'
  }

  async checkStatusBatch(
    targetType: InteractionTargetType,
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
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    return this.interact(targetType, targetId, userId)
  }

  async unfavorite(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    return this.cancelInteract(targetType, targetId, userId)
  }

  async checkFavoriteStatus(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<boolean> {
    return this.checkStatus(targetType, targetId, userId)
  }

  async getUserFavorites(
    userId: number,
    targetType?: InteractionTargetType,
    page: number = 0,
    pageSize: number = 15,
  ): Promise<{ list: { targetId: number, targetType: number, createdAt: Date }[], total: number }> {
    const where = {
      userId,
      ...(targetType !== undefined && { targetType }),
    }

    const [favorites, total] = await Promise.all([
      this.prisma.userFavorite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: page * pageSize,
        take: pageSize,
        select: {
          targetId: true,
          targetType: true,
          createdAt: true,
        },
      }),
      this.prisma.userFavorite.count({ where }),
    ])

    return { list: favorites, total }
  }
}
