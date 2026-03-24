import type { Db } from '@db/core'
import type {IFollowTargetResolver} from '@libs/interaction/follow';
import { DrizzleService } from '@db/core'
import {
  FollowService,
  FollowTargetTypeEnum

} from '@libs/interaction/follow'
import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common'
import { ForumCounterService } from '../../counter'
import { ForumPermissionService } from '../../permission'

/**
 * 论坛板块关注解析器
 * 负责处理板块作为关注目标时的校验、计数和列表详情聚合
 */
@Injectable()
export class ForumSectionFollowResolver
  implements IFollowTargetResolver, OnModuleInit
{
  readonly targetType = FollowTargetTypeEnum.FORUM_SECTION

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly followService: FollowService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly forumCounterService: ForumCounterService,
  ) {}

  onModuleInit() {
    this.followService.registerResolver(this)
  }

  async ensureExists(tx: Db, targetId: number, actorUserId: number) {
    await this.forumPermissionService.ensureUserCanAccessSection(
      targetId,
      actorUserId,
      {
        requireEnabled: true,
        notFoundMessage: '板块不存在',
      },
    )

    const section = await tx.query.forumSection.findFirst({
      where: {
        id: targetId,
        isEnabled: true,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!section) {
      throw new BadRequestException('板块不存在')
    }

    return {}
  }

  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    await this.forumCounterService.updateSectionFollowersCount(tx, targetId, delta)
  }

  async batchGetDetails(targetIds: number[]) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const sections = await this.drizzle.db.query.forumSection.findMany({
      where: {
        id: { in: targetIds },
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        name: true,
        description: true,
        icon: true,
        topicCount: true,
        commentCount: true,
        followersCount: true,
      },
    })

    return new Map(
      sections.map((section) => [
        section.id,
        {
          id: section.id,
          name: section.name,
          description: section.description ?? undefined,
          icon: section.icon ?? undefined,
          topicCount: section.topicCount,
          commentCount: section.commentCount,
          followersCount: section.followersCount,
        },
      ]),
    )
  }
}
