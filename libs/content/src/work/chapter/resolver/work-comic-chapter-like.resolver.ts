import type { PrismaTransactionClientType } from '@libs/base/database/prisma.types'
import { InteractionTargetTypeEnum, SceneTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { ILikeTargetResolver } from '@libs/interaction/like/interfaces/like-target-resolver.interface'
import { LikeService } from '@libs/interaction/like/like.service'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'

@Injectable()
export class WorkComicChapterLikeResolver
  extends BaseService
  implements ILikeTargetResolver, OnModuleInit
{
  readonly targetType = InteractionTargetTypeEnum.COMIC_CHAPTER
  private readonly workType = 1

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
    const chapter = await tx.workChapter.findFirst({
      where: {
        id: targetId,
        workType: this.workType,
        deletedAt: null,
      },
      select: { id: true },
    })

    if (!chapter) {
      throw new NotFoundException('目标不存在')
    }

    return {
      sceneType: SceneTypeEnum.COMIC_CHAPTER,
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

    await tx.workChapter.applyCountDelta(
      {
        id: targetId,
        workType: this.workType,
        deletedAt: null,
      },
      'likeCount',
      delta,
    )
  }
}
