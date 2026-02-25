import { Injectable } from '@nestjs/common'
import { BaseInteractionService } from '../base-interaction.service'
import { CounterService } from '../counter/counter.service'
import { InteractionActionType, InteractionTargetType } from '../interaction.constant'
import { TargetValidatorRegistry } from '../validator/target-validator.registry'

@Injectable()
export class LikeService extends BaseInteractionService {
  constructor(
    protected readonly counterService: CounterService,
    protected readonly validatorRegistry: TargetValidatorRegistry,
  ) {
    super()
  }

  protected getActionType(): InteractionActionType {
    return InteractionActionType.LIKE
  }

  protected getCancelActionType(): InteractionActionType {
    return InteractionActionType.UNLIKE
  }

  protected async checkUserInteracted(
    targetType: InteractionTargetType,
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
    })
    return !!like
  }

  protected async createInteraction(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.prisma.userLike.create({
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
    await this.prisma.userLike.delete({
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
    return 'likeCount'
  }

  async checkStatusBatch(
    targetType: InteractionTargetType,
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
    targetType: InteractionTargetType,
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
    targetType: InteractionTargetType,
    targetId: number,
  ): Promise<number> {
    return this.getCount(targetType, targetId)
  }

  async getLikeCounts(
    targetType: InteractionTargetType,
    targetIds: number[],
  ): Promise<Map<number, number>> {
    return this.getCounts(targetType, targetIds)
  }

  async like(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    return this.interact(targetType, targetId, userId)
  }

  async unlike(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    return this.cancelInteract(targetType, targetId, userId)
  }

  async checkLikeStatus(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<boolean> {
    return this.checkStatus(targetType, targetId, userId)
  }

  async getUserLikes(
    userId: number,
    targetType?: InteractionTargetType,
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
}
