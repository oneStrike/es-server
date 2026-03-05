import { BaseService } from '@libs/base/database'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InteractionTargetType } from '../common.constant'

@Injectable()
export class LikeService extends BaseService {
  private getTargetCountModel(tx: any, targetType: InteractionTargetType) {
    switch (targetType) {
      case InteractionTargetType.COMIC:
      case InteractionTargetType.NOVEL:
        return tx.work
      case InteractionTargetType.COMIC_CHAPTER:
      case InteractionTargetType.NOVEL_CHAPTER:
        return tx.workChapter
      case InteractionTargetType.FORUM_TOPIC:
        return tx.forumTopic
      default:
        throw new BadRequestException('Unsupported target type')
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
      case InteractionTargetType.COMIC_CHAPTER:
        return { id: targetId, workType: 1, deletedAt: null }
      case InteractionTargetType.NOVEL_CHAPTER:
        return { id: targetId, workType: 2, deletedAt: null }
      case InteractionTargetType.FORUM_TOPIC:
        return { id: targetId, deletedAt: null }
      default:
        throw new BadRequestException('Unsupported target type')
    }
  }

  /**
   * Keep validation explicit so "target not found" is returned before
   * duplicate-like checks, matching the previous user-facing behavior.
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

  private isDuplicateLikeError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    )
  }

  /**
   * Centralize count mutation with a single UPDATE statement and shared guards.
   */
  private async applyLikeCountDelta(
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
          likeCount: {
            increment: delta,
          },
        },
      })

      // If the target disappeared between validation and write, rollback.
      if (updated.count === 0) {
        throw new NotFoundException('Target not found')
      }
      return
    }

    const amount = Math.abs(delta)
    await model.updateMany({
      where: {
        ...where,
        likeCount: { gte: amount },
      },
      data: {
        likeCount: {
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
    const model = this.getTargetCountModel(this.prisma, targetType)
    const target = await model.findUnique({
      where: { id: targetId },
      select: { likeCount: true },
    })
    return target?.likeCount ?? 0
  }

  async getLikeCounts(
    targetType: InteractionTargetType,
    targetIds: number[],
  ): Promise<Map<number, number>> {
    if (targetIds.length === 0) {
      return new Map()
    }

    const model = this.getTargetCountModel(this.prisma, targetType)
    const targets = await model.findMany({
      where: {
        id: { in: targetIds },
      },
      select: {
        id: true,
        likeCount: true,
      },
    })

    const countMap = new Map<number, number>()
    for (const target of targets) {
      countMap.set(target.id, target.likeCount ?? 0)
    }

    return countMap
  }

  async like(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.ensureTargetExists(targetType, targetId)

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
        if (this.isDuplicateLikeError(error)) {
          throw new BadRequestException('Already liked')
        }
        throw error
      }

      await this.applyLikeCountDelta(tx, targetType, targetId, 1)
    })
  }

  async unlike(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.ensureTargetExists(targetType, targetId)

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
          throw new BadRequestException('Not liked yet')
        }
        throw error
      }

      await this.applyLikeCountDelta(tx, targetType, targetId, -1)
    })
  }

  async checkLikeStatus(
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
      select: { id: true },
    })
    return !!like
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
