import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { BrowseLogTargetTypeEnum } from '@libs/interaction/browse-log/browse-log.constant'
import { BrowseLogService } from '@libs/interaction/browse-log/browse-log.service'
import { IBrowseLogTargetResolver } from '@libs/interaction/browse-log/interfaces/browse-log-target-resolver.interface'
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
  /** 目标类型：论坛帖子 */
  readonly targetType = BrowseLogTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly browseLogService: BrowseLogService,
    private readonly drizzle: DrizzleService,
    private readonly forumCounterService: ForumCounterService,
    private readonly forumPermissionService: ForumPermissionService,
  ) {}

  private get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.browseLogService.registerResolver(this)
  }

  /**
   * 应用浏览计数增量
   * 更新帖子的浏览数
   *
   * @param tx - 事务客户端
   * @param targetId - 目标帖子ID
   * @param delta - 变更量
   */
  applyCountDelta: (tx: Db, targetId: number, delta: number) => Promise<void> =
    async (tx, targetId, delta) => {
      await this.forumCounterService.updateTopicViewCount(tx, targetId, delta)
    }

  /**
   * 校验帖子是否有效
   *
   * @param tx - 事务客户端
   * @param targetId - 目标帖子ID
   * @throws 当帖子不存在时抛出 BadRequestException
   */
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
