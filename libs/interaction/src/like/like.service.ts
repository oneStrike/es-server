import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { InteractionTargetResolverService } from '../interaction-target-resolver.service'
import { LikeGrowthService } from './like-growth.service'
import { LikeInteractionService } from './like-interaction.service'
import { LikePermissionService } from './like-permission.service'

@Injectable()
export class LikeService extends BaseService {
  constructor(
    private readonly likePermissionService: LikePermissionService,
    private readonly likeInteractionService: LikeInteractionService,
    private readonly likeGrowthService: LikeGrowthService,
    private readonly interactionTargetResolverService: InteractionTargetResolverService,
  ) {
    super()
  }

  private getTargetModel(client: any, targetType: InteractionTargetTypeEnum) {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
      case InteractionTargetTypeEnum.NOVEL:
        return client.work
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return client.workChapter
      case InteractionTargetTypeEnum.FORUM_TOPIC:
        return client.forumTopic
      case InteractionTargetTypeEnum.COMMENT:
        return client.userComment
      default:
        throw new Error(`Unsupported interaction target type: ${targetType}`)
    }
  }

  private getTargetWhere(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
        return { id: targetId, type: 1, deletedAt: null }
      case InteractionTargetTypeEnum.NOVEL:
        return { id: targetId, type: 2, deletedAt: null }
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
        return { id: targetId, workType: 1, deletedAt: null }
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return { id: targetId, workType: 2, deletedAt: null }
      case InteractionTargetTypeEnum.FORUM_TOPIC:
      case InteractionTargetTypeEnum.COMMENT:
        return { id: targetId, deletedAt: null }
      default:
        throw new Error(`Unsupported interaction target type: ${targetType}`)
    }
  }

  private getTargetListWhere(
    targetType: InteractionTargetTypeEnum,
    targetIds: number[],
  ) {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
        return { id: { in: targetIds }, type: 1, deletedAt: null }
      case InteractionTargetTypeEnum.NOVEL:
        return { id: { in: targetIds }, type: 2, deletedAt: null }
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
        return { id: { in: targetIds }, workType: 1, deletedAt: null }
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return { id: { in: targetIds }, workType: 2, deletedAt: null }
      case InteractionTargetTypeEnum.FORUM_TOPIC:
      case InteractionTargetTypeEnum.COMMENT:
        return { id: { in: targetIds }, deletedAt: null }
      default:
        throw new Error(`Unsupported interaction target type: ${targetType}`)
    }
  }

  private async applyTargetCountDelta(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    field: string,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    const model = this.getTargetModel(tx, targetType)
    const where = this.getTargetWhere(targetType, targetId)
    await model.applyCountDelta(where, field, delta)
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

    const likedSet = new Set(likes.map((item) => item.targetId))
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
        id: true,
        userId: true,
        sceneType: true,
        sceneId: true,
        commentLevel: true,
        createdAt: true,
      },
    })
  }

  async getLikeCount(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<number> {
    const model = this.getTargetModel(this.prisma, targetType)
    const where = this.getTargetWhere(targetType, targetId)
    const result = await model.findFirst({
      where,
      select: {
        likeCount: true,
      },
    })

    return result?.likeCount ?? 0
  }

  async getLikeCounts(
    targetType: InteractionTargetTypeEnum,
    targetIds: number[],
  ): Promise<Map<number, number>> {
    const countMap = new Map<number, number>()

    if (targetIds.length === 0) {
      return countMap
    }

    const model = this.getTargetModel(this.prisma, targetType)
    const where = this.getTargetListWhere(targetType, targetIds)
    const results = await model.findMany({
      where,
      select: {
        id: true,
        likeCount: true,
      },
    })

    for (const item of results) {
      countMap.set(item.id, item.likeCount ?? 0)
    }

    return countMap
  }

  async like(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.likePermissionService.ensureCanLike(userId, targetType, targetId)

    const targetMeta = await this.interactionTargetResolverService.resolveLikeTargetMeta(
      targetType,
      targetId,
    )

    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.userLike.create({
          data: {
            targetType,
            targetId,
            sceneType: targetMeta.sceneType,
            sceneId: targetMeta.sceneId,
            commentLevel: targetMeta.commentLevel,
            userId,
          },
        })
      } catch (error) {
        this.handlePrismaBusinessError(error, {
          duplicateMessage: 'Already liked',
        })
      }

      await this.applyTargetCountDelta(tx, targetType, targetId, 'likeCount', 1)

      await this.likeInteractionService.handleLikeCreated(tx, {
        targetType,
        targetId,
        userId,
      })
    })

    await this.likeGrowthService.rewardLikeCreated(targetType, targetId, userId)
  }

  async unlike(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.likePermissionService.ensureCanUnlike(
      userId,
      targetType,
      targetId,
    )

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
        this.handlePrismaBusinessError(error, {
          notFoundMessage: 'Like record not found',
        })
      }

      await this.applyTargetCountDelta(tx, targetType, targetId, 'likeCount', -1)
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
        id: true,
        targetId: true,
        targetType: true,
        sceneType: true,
        sceneId: true,
        commentLevel: true,
        createdAt: true,
      },
    })
  }
}
