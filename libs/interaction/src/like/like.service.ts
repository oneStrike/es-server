import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ILikeTargetResolver } from './interfaces/like-target-resolver.interface'
import { LikeGrowthService } from './like-growth.service'

@Injectable()
export class LikeService extends BaseService {
  private readonly resolvers = new Map<
    InteractionTargetTypeEnum,
    ILikeTargetResolver
  >()

  constructor(private readonly likeGrowthService: LikeGrowthService) {
    super()
  }

  registerResolver(resolver: ILikeTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `Like resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  private getResolver(
    targetType: InteractionTargetTypeEnum,
  ): ILikeTargetResolver {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BadRequestException('不支持的点赞目标类型')
    }
    return resolver
  }

  private getTargetModel(client: any, targetType: InteractionTargetTypeEnum) {
    if (
      targetType === InteractionTargetTypeEnum.COMIC ||
      targetType === InteractionTargetTypeEnum.NOVEL
    ) {
      return client.work
    }

    if (
      targetType === InteractionTargetTypeEnum.COMIC_CHAPTER ||
      targetType === InteractionTargetTypeEnum.NOVEL_CHAPTER
    ) {
      return client.workChapter
    }

    if (targetType === InteractionTargetTypeEnum.FORUM_TOPIC) {
      return client.forumTopic
    }

    if (targetType === InteractionTargetTypeEnum.COMMENT) {
      return client.userComment
    }

    throw new BadRequestException('不支持的点赞目标类型')
  }

  private resolveWorkType(targetType: InteractionTargetTypeEnum) {
    if (
      targetType === InteractionTargetTypeEnum.COMIC ||
      targetType === InteractionTargetTypeEnum.COMIC_CHAPTER
    ) {
      return 1
    }

    if (
      targetType === InteractionTargetTypeEnum.NOVEL ||
      targetType === InteractionTargetTypeEnum.NOVEL_CHAPTER
    ) {
      return 2
    }

    throw new BadRequestException('不支持的点赞目标类型')
  }

  private buildTargetWhere(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    if (
      targetType === InteractionTargetTypeEnum.COMIC ||
      targetType === InteractionTargetTypeEnum.NOVEL
    ) {
      return {
        id: targetId,
        type: this.resolveWorkType(targetType),
        deletedAt: null,
      }
    }

    if (
      targetType === InteractionTargetTypeEnum.COMIC_CHAPTER ||
      targetType === InteractionTargetTypeEnum.NOVEL_CHAPTER
    ) {
      return {
        id: targetId,
        workType: this.resolveWorkType(targetType),
        deletedAt: null,
      }
    }

    if (targetType === InteractionTargetTypeEnum.FORUM_TOPIC) {
      return { id: targetId, deletedAt: null }
    }

    if (targetType === InteractionTargetTypeEnum.COMMENT) {
      return { id: targetId, deletedAt: null }
    }

    throw new BadRequestException('不支持的点赞目标类型')
  }

  private buildTargetListWhere(
    targetType: InteractionTargetTypeEnum,
    targetIds: number[],
  ) {
    if (
      targetType === InteractionTargetTypeEnum.COMIC ||
      targetType === InteractionTargetTypeEnum.NOVEL
    ) {
      return {
        id: { in: targetIds },
        type: this.resolveWorkType(targetType),
        deletedAt: null,
      }
    }

    if (
      targetType === InteractionTargetTypeEnum.COMIC_CHAPTER ||
      targetType === InteractionTargetTypeEnum.NOVEL_CHAPTER
    ) {
      return {
        id: { in: targetIds },
        workType: this.resolveWorkType(targetType),
        deletedAt: null,
      }
    }

    if (targetType === InteractionTargetTypeEnum.FORUM_TOPIC) {
      return { id: { in: targetIds }, deletedAt: null }
    }

    if (targetType === InteractionTargetTypeEnum.COMMENT) {
      return { id: { in: targetIds }, deletedAt: null }
    }

    throw new BadRequestException('不支持的点赞目标类型')
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
    const where = this.buildTargetWhere(targetType, targetId)
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
    const where = this.buildTargetListWhere(targetType, targetIds)
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
    const resolver = this.getResolver(targetType)

    await this.prisma.$transaction(async (tx) => {
      const targetMeta = await resolver.resolveMeta(tx, targetId)

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
          duplicateMessage: '已点赞',
        })
      }

      await resolver.applyCountDelta(tx, targetId, 1)

      if (resolver.postLikeHook) {
        await resolver.postLikeHook(tx, targetId, userId, targetMeta)
      }
    })

    await this.likeGrowthService.rewardLikeCreated(targetType, targetId, userId)
  }

  async unlike(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    const resolver = this.getResolver(targetType)

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
          notFoundMessage: '点赞记录不存在',
        })
      }

      await resolver.applyCountDelta(tx, targetId, -1)
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
    targetType: InteractionTargetTypeEnum,
    pageIndex: number = 0,
    pageSize: number = 15,
  ) {
    const page = await this.prisma.userLike.findPagination({
      where: {
        userId,
        targetType,
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

    if (page.list.length === 0) {
      return page
    }

    const resolver = this.getResolver(targetType)
    if (!resolver.batchGetDetails) {
      return page
    }

    const targetIds = [...new Set(page.list.map((item) => item.targetId))]
    if (targetIds.length === 0) {
      return page
    }

    const detailMap = await resolver.batchGetDetails(targetIds)
    if (!detailMap || detailMap.size === 0) {
      return page
    }

    return {
      ...page,
      list: page.list.map((item) => {
        const detail = detailMap.get(item.targetId)
        if (detail) {
          return {
            ...item,
            work: detail,
          }
        }
        return item
      }),
    }
  }
}
