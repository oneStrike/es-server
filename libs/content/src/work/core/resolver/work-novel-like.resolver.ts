import type { PrismaTransactionClientType } from '@libs/base/database/prisma.types'
import { InteractionTargetTypeEnum, SceneTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { ILikeTargetResolver } from '@libs/interaction/like/interfaces/like-target-resolver.interface'
import { LikeService } from '@libs/interaction/like/like.service'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'

@Injectable()
export class WorkNovelLikeResolver
  extends BaseService
  implements ILikeTargetResolver, OnModuleInit
{
  readonly targetType = InteractionTargetTypeEnum.NOVEL

  constructor(private readonly likeService: LikeService) {
    super()
  }

  onModuleInit() {
    this.likeService.registerResolver(this)
  }

  async resolveMeta(
    tx: PrismaTransactionClientType,
    targetId: number,
  ) {
    const work = await tx.work.findFirst({
      where: {
        id: targetId,
        type: this.targetType,
        deletedAt: null,
      },
      select: { id: true },
    })

    if (!work) {
      throw new NotFoundException('目标不存在')
    }

    return {
      sceneType: SceneTypeEnum.NOVEL_WORK,
      sceneId: targetId,
    }
  }

  async applyCountDelta(
    tx: PrismaTransactionClientType,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    await tx.work.applyCountDelta(
      {
        id: targetId,
        type: this.targetType,
        deletedAt: null,
      },
      'likeCount',
      delta,
    )
  }

  async batchGetDetails(targetIds: number[]) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const works = await this.prisma.work.findMany({
      where: {
        id: { in: targetIds },
        type: this.targetType,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        cover: true,
      },
    })

    return new Map(works.map((work) => [work.id, work]))
  }
}
