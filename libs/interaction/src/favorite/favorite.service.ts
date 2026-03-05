import { BaseService } from '@libs/base/database'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InteractionTargetType } from '../common.constant'

@Injectable()
export class FavoriteService extends BaseService {
  private getTargetCountModel(tx: any, targetType: InteractionTargetType) {
    switch (targetType) {
      case InteractionTargetType.COMIC:
      case InteractionTargetType.NOVEL:
        return tx.work
      case InteractionTargetType.FORUM_TOPIC:
        return tx.forumTopic
      case InteractionTargetType.COMIC_CHAPTER:
      case InteractionTargetType.NOVEL_CHAPTER:
      default:
        throw new BadRequestException('不支持的收藏类型')
    }
  }

  private getTargetCountWhere(
    targetType: InteractionTargetType,
    targetId: number,
  ) {
    switch (targetType) {
      case InteractionTargetType.COMIC:
        return { id: targetId, type: 1, deletedAt: null }
      case InteractionTargetType.NOVEL:
        return { id: targetId, type: 2, deletedAt: null }
      case InteractionTargetType.FORUM_TOPIC:
        return { id: targetId, deletedAt: null }
      default:
        throw new BadRequestException('Unsupported target type')
    }
  }

  /**
   * 显式校验目标，保证“目标不存在”优先于“已收藏/未收藏”等状态错误。
   */
  private async ensureTargetExists(
    targetType: InteractionTargetType,
    targetId: number,
  ) {
    const where = this.getTargetCountWhere(targetType, targetId)
    const model = this.getTargetCountModel(this.prisma, targetType)
    const target = await model.findFirst({
      where,
      select: { id: true },
    })

    if (!target) {
      throw new NotFoundException('Target not found')
    }
  }

  private isDuplicateFavoriteError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    )
  }

  private isRecordNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2025'
    )
  }

  /**
   * 统一维护 favoriteCount，避免分散更新逻辑导致计数不一致。
   */
  private async applyFavoriteCountDelta(
    tx: any,
    targetType: InteractionTargetType,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    const model = this.getTargetCountModel(tx, targetType)
    const where = this.getTargetCountWhere(targetType, targetId)

    if (delta > 0) {
      const updated = await model.updateMany({
        where,
        data: {
          favoriteCount: {
            increment: delta,
          },
        },
      })

      if (updated.count === 0) {
        throw new NotFoundException('Target not found')
      }
      return
    }

    const amount = Math.abs(delta)
    await model.updateMany({
      where: {
        ...where,
        favoriteCount: { gte: amount },
      },
      data: {
        favoriteCount: {
          decrement: amount,
        },
      },
    })
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
    await this.ensureTargetExists(targetType, targetId)

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
        if (this.isDuplicateFavoriteError(error)) {
          throw new BadRequestException('Already favorited')
        }
        throw error
      }

      await this.applyFavoriteCountDelta(tx, targetType, targetId, 1)
    })
  }

  async unfavorite(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.ensureTargetExists(targetType, targetId)

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
        if (this.isRecordNotFound(error)) {
          throw new BadRequestException('Not favorited yet')
        }
        throw error
      }

      await this.applyFavoriteCountDelta(tx, targetType, targetId, -1)
    })
  }

  async checkFavoriteStatus(
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
      select: { id: true },
    })
    return !!favorite
  }

  async getUserFavorites(
    userId: number,
    targetType?: InteractionTargetType,
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
