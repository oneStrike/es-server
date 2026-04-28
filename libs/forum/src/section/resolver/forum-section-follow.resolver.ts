import type { Db } from '@db/core'
import type { IFollowTargetResolver } from '@libs/interaction/follow/interfaces/follow-target-resolver.interface'
import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { FollowService } from '@libs/interaction/follow/follow.service'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { ForumCounterService } from '../../counter/forum-counter.service'
import { ForumPermissionService } from '../../permission/forum-permission.service'
import { ForumSectionService } from '../forum-section.service'

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
    private readonly followService: FollowService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly forumCounterService: ForumCounterService,
    private readonly forumSectionService: ForumSectionService,
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

    return {}
  }

  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    await this.forumCounterService.updateSectionFollowersCount(
      tx,
      targetId,
      delta,
    )
  }

  async batchGetDetails(targetIds: number[], userId?: number) {
    const sections = await this.forumSectionService.batchGetVisibleSectionListItems(
      targetIds,
      userId,
    )

    return new Map(sections.map((section) => [section.id, section]))
  }
}
