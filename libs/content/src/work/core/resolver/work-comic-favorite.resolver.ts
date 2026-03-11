import { FavoriteService } from '@libs/interaction/favorite/favorite.service'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { IFavoriteTargetResolver } from '@libs/interaction/favorite/interfaces/favorite-target-resolver.interface'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import type { PrismaClientType } from '@libs/base/database/prisma.types'
import { BaseService } from '@libs/base/database'

@Injectable()
export class WorkComicFavoriteResolver
  extends BaseService
  implements IFavoriteTargetResolver, OnModuleInit
{
  readonly targetType = FavoriteTargetTypeEnum.WORK_COMIC

  constructor(private readonly favoriteService: FavoriteService) {
    super()
  }

  onModuleInit() {
    this.favoriteService.registerResolver(this)
  }

  async ensureExists(tx: PrismaClientType, targetId: number) {
    const work = await tx.work.findFirst({
      where: {
        id: targetId,
        type: this.targetType,
        deletedAt: null,
      },
      select: { id: true },
    })

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    return {}
  }

  async applyCountDelta(tx: PrismaClientType, targetId: number, delta: number) {
    if (delta === 0) return

    await tx.work.applyCountDelta(
      {
        id: targetId,
        type: this.targetType,
        deletedAt: null,
      },
      'favoriteCount',
      delta,
    )
  }

  async batchGetDetails(targetIds: number[]) {
    if (targetIds.length === 0) return new Map()

    const works = await this.prisma.work.findMany({
      where: {
        id: { in: targetIds },
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
