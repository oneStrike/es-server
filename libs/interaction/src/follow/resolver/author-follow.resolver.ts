import type { Db } from '@db/core'
import type { IFollowTargetResolver } from '../interfaces/follow-target-resolver.interface'
import { DrizzleService } from '@db/core'
import { WorkAuthorService } from '@libs/content/author/author.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { FollowTargetTypeEnum } from '../follow.constant'
import { FollowService } from '../follow.service'

/**
 * 作者关注解析器
 * 负责处理作者作为关注目标时的校验、计数和列表详情聚合
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

  onModuleInit() {
    this.followService.registerResolver(this)
  }

  async ensureExists(tx: Db, targetId: number) {
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

  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    await this.workAuthorService.updateAuthorFollowersCount(tx, targetId, delta)
  }

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
          avatar: author.avatar ?? undefined,
          type: author.type ?? undefined,
          followersCount: author.followersCount,
        },
      ]),
    )
  }
}
