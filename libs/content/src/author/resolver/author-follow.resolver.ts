import type { DbExecutor } from '@db/core'
import type { IFollowTargetResolver } from '@libs/interaction/follow/interfaces/follow-target-resolver.type'
import { DrizzleService } from '@db/core'
import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { FollowService } from '@libs/interaction/follow/follow.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { WorkAuthorService } from '../author.service'

/**
 * 作者关注目标解析器。
 * 由作者域维护作者存在性、关注数与列表快照，并在启动时注册到关注服务。
 */
@Injectable()
export class AuthorFollowResolver
  implements IFollowTargetResolver, OnModuleInit
{
  readonly targetType = FollowTargetTypeEnum.AUTHOR

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly followService: FollowService,
    private readonly workAuthorService: WorkAuthorService,
  ) {}

  // 将作者目标解析能力注册到关注服务。
  onModuleInit() {
    this.followService.registerResolver(this)
  }

  // 校验目标作者存在且仍可被关注。
  async ensureExists(tx: DbExecutor, targetId: number) {
    const author = await tx.query.workAuthor.findFirst({
      where: {
        id: targetId,
        isEnabled: true,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!author) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '作者不存在',
      )
    }

    return {}
  }

  // 在关注事务内同步作者关注数。
  async applyCountDelta(tx: DbExecutor, targetId: number, delta: number) {
    await this.workAuthorService.updateAuthorFollowersCount(tx, targetId, delta)
  }

  // 批量装配关注列表所需的作者摘要。
  async batchGetDetails(targetIds: number[]) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const authors = await this.drizzle.db.query.workAuthor.findMany({
      where: {
        id: { in: targetIds },
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        name: true,
        avatar: true,
        type: true,
        followersCount: true,
      },
    })

    return new Map(
      authors.map((author) => [
        author.id,
        {
          id: author.id,
          name: author.name,
          avatar: author.avatar ?? null,
          type: author.type ?? null,
          followersCount: author.followersCount,
        },
      ]),
    )
  }
}
