import {
  CommentLevelEnum,
  InteractionTargetTypeEnum,
  SceneTypeEnum,
} from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { mapInteractionTargetTypeToSceneType } from '../interaction-target.definition'
import { LikeGrowthService } from './like-growth.service'
import { LikeInteractionService } from './like-interaction.service'

interface LikeTargetMeta {
  sceneType: SceneTypeEnum
  sceneId: number
  commentLevel?: CommentLevelEnum
}

@Injectable()
export class LikeService extends BaseService {
  constructor(
    private readonly likeInteractionService: LikeInteractionService,
    private readonly likeGrowthService: LikeGrowthService,
  ) {
    super()
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

  private async ensureTargetExists(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    const model = this.getTargetModel(tx, targetType)
    const where = this.buildTargetWhere(targetType, targetId)
    const target = await model.findFirst({
      where,
      select: { id: true },
    })

    if (!target) {
      throw new NotFoundException('目标不存在')
    }
  }

  private mapCommentTargetTypeToSceneType(
    targetType: InteractionTargetTypeEnum,
  ): SceneTypeEnum {
    if (targetType === InteractionTargetTypeEnum.COMMENT) {
      throw new BadRequestException(
        '评论不能继续挂载评论作为场景目标',
      )
    }

    const sceneType = mapInteractionTargetTypeToSceneType(targetType)
    if (!sceneType) {
      throw new BadRequestException('评论挂载的目标类型不合法')
    }

    return sceneType
  }

  private async resolveLikeTargetMeta(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<LikeTargetMeta> {
    if (targetType === InteractionTargetTypeEnum.COMMENT) {
      const comment = await tx.userComment.findFirst({
        where: { id: targetId, deletedAt: null },
        select: {
          id: true,
          targetType: true,
          targetId: true,
          replyToId: true,
        },
      })

      if (!comment) {
        throw new NotFoundException('评论不存在')
      }

      const sceneType = this.mapCommentTargetTypeToSceneType(
        comment.targetType as InteractionTargetTypeEnum,
      )
      const commentLevel = comment.replyToId
        ? CommentLevelEnum.REPLY
        : CommentLevelEnum.ROOT

      return {
        sceneType,
        sceneId: comment.targetId,
        commentLevel,
      }
    }

    const sceneType = mapInteractionTargetTypeToSceneType(targetType)
    if (!sceneType) {
      throw new BadRequestException('不支持的点赞目标类型')
    }

    await this.ensureTargetExists(tx, targetType, targetId)

    return {
      sceneType,
      sceneId: targetId,
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
    const where = this.buildTargetWhere(targetType, targetId)
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
    const targetMeta = await this.resolveLikeTargetMeta(
      this.prisma,
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
          duplicateMessage: '已点赞',
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

    if (
      targetType !== InteractionTargetTypeEnum.COMIC &&
      targetType !== InteractionTargetTypeEnum.NOVEL
    ) {
      return page
    }

    const workTargetIds = [
      ...new Set(page.list.map((item) => item.targetId)),
    ]

    if (workTargetIds.length === 0) {
      return page
    }

    const works = await this.prisma.work.findMany({
      where: {
        id: { in: workTargetIds },
        type: this.resolveWorkType(targetType),
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        cover: true,
      },
    })

    const workMap = new Map(works.map((work) => [work.id, work]))

    return {
      ...page,
      list: page.list.map((item) => {
        const work = workMap.get(item.targetId)
        if (work) {
          return {
            ...item,
            work,
          }
        }
        return item
      }),
    }
  }
}
