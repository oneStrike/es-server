import type { Db } from '@db/core'
import type { IReportTargetResolver } from '@libs/interaction/report/interfaces/report-target-resolver.type'
import { ReportTargetTypeEnum } from '@libs/interaction/report/report.constant'
import { ReportService } from '@libs/interaction/report/report.service'
import {
  AuditStatusEnum,
  BusinessErrorCode,
  SceneTypeEnum,
} from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { ForumPermissionService } from '../../permission/forum-permission.service'

/**
 * 论坛主题举报解析器
 * 负责处理论坛主题的举报业务逻辑，包括验证主题存在性、解析场景元数据、返回主题作者ID等
 */
@Injectable()
export class ForumTopicReportResolver
  implements IReportTargetResolver, OnModuleInit
{
  // 标识本 resolver 处理论坛主题举报目标。
  readonly targetType = ReportTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly reportService: ReportService,
    private readonly forumPermissionService: ForumPermissionService,
  ) {}

  // 模块初始化时向举报服务注册 forum topic resolver。
  onModuleInit() {
    this.reportService.registerResolver(this)
  }

  // 校验主题公开可见，并返回举报场景和主题作者。
  async resolveMeta(tx: Db, targetId: number) {
    const topic = await tx.query.forumTopic.findFirst({
      where: {
        id: targetId,
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        userId: true,
      },
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

    return {
      sceneType: SceneTypeEnum.FORUM_TOPIC,
      sceneId: targetId,
      ownerUserId: topic.userId,
    }
  }
}
