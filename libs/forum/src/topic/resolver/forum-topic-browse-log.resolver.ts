import type { Db } from '@db/core'
import type { IBrowseLogTargetResolver } from '@libs/interaction/browse-log/interfaces/browse-log-target-resolver.interface'
import { DrizzleService } from '@db/core'
import { BrowseLogTargetTypeEnum } from '@libs/interaction/browse-log/browse-log.constant'
import { BrowseLogService } from '@libs/interaction/browse-log/browse-log.service'
import { AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { ForumCounterService } from '../../counter/forum-counter.service'
import { ForumPermissionService } from '../../permission/forum-permission.service'

/**
 * 论坛帖子浏览日志解析器
 * 处理论坛帖子的浏览记录相关操作
 */
@Injectable()
export class ForumTopicBrowseLogResolver
  implements IBrowseLogTargetResolver, OnModuleInit
{
  // 标识本 resolver 处理论坛主题浏览日志。
  readonly targetType = BrowseLogTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly browseLogService: BrowseLogService,
    private readonly drizzle: DrizzleService,
    private readonly forumCounterService: ForumCounterService,
    private readonly forumPermissionService: ForumPermissionService,
  ) {}

  // 模块初始化时向浏览日志服务注册 forum topic resolver。
  onModuleInit() {
    this.browseLogService.registerResolver(this)
  }

  // 在浏览日志事务中同步主题浏览计数增量。
  applyCountDelta: (tx: Db, targetId: number, delta: number) => Promise<void> =
    async (tx, targetId, delta) => {
      await this.forumCounterService.updateTopicViewCount(tx, targetId, delta)
    }

  // 校验主题仍公开可见，否则按资源不存在处理。
  ensureTargetValid: (tx: Db, targetId: number) => Promise<void> = async (
    tx,
    targetId,
  ) => {
    const topic = await tx.query.forumTopic.findFirst({
      where: {
        id: targetId,
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
      with: {
        section: {
          columns: {
            groupId: true,
            deletedAt: true,
            isEnabled: true,
          },
          with: {
            group: {
              columns: {
                isEnabled: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    })

    if (
      !topic ||
      !topic.section ||
      !this.forumPermissionService.isSectionPubliclyAvailable(topic.section)
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '帖子不存在',
      )
    }
  }
}
