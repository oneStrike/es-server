import type { Db } from '@db/core'
import type { IFollowTargetResolver } from '@libs/interaction/follow/interfaces/follow-target-resolver.interface'
import { DrizzleService } from '@db/core'
import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { FollowService } from '@libs/interaction/follow/follow.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { ForumHashtagCounterService } from '../forum-hashtag-counter.service'

/**
 * forum 话题关注解析器。
 * 负责 hashtag 作为 follow target 时的存在性校验和详情聚合。
 */
@Injectable()
export class ForumHashtagFollowResolver
  implements IFollowTargetResolver, OnModuleInit
{
  readonly targetType = FollowTargetTypeEnum.FORUM_HASHTAG

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly followService: FollowService,
    private readonly forumHashtagCounterService: ForumHashtagCounterService,
  ) {}

  onModuleInit() {
    this.followService.registerResolver(this)
  }

  async ensureExists(tx: Db, targetId: number) {
    const hashtag = await tx.query.forumHashtag.findFirst({
      where: {
        id: targetId,
        deletedAt: { isNull: true },
        auditStatus: 1,
        isHidden: false,
      },
      columns: {
        id: true,
      },
    })

    if (!hashtag) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '话题不存在或不可关注',
      )
    }

    return {}
  }

  async applyCountDelta(tx: Db, targetId: number) {
    await this.forumHashtagCounterService.rebuildHashtagStatsInTx(tx, [
      targetId,
    ])
  }

  async batchGetDetails(targetIds: number[]) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const hashtags = await this.drizzle.db.query.forumHashtag.findMany({
      where: {
        id: { in: targetIds },
        deletedAt: { isNull: true },
        auditStatus: 1,
        isHidden: false,
      },
      columns: {
        id: true,
        slug: true,
        displayName: true,
        description: true,
        topicRefCount: true,
        commentRefCount: true,
        followerCount: true,
        lastReferencedAt: true,
      },
    })

    return new Map(
      hashtags.map((hashtag) => [
        hashtag.id,
        {
          id: hashtag.id,
          slug: hashtag.slug,
          displayName: hashtag.displayName,
          description: hashtag.description ?? undefined,
          topicRefCount: hashtag.topicRefCount,
          commentRefCount: hashtag.commentRefCount,
          followerCount: hashtag.followerCount,
          lastReferencedAt: hashtag.lastReferencedAt ?? undefined,
        },
      ]),
    )
  }
}
