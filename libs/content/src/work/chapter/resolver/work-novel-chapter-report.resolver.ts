import type { Db } from '@db/core'
import { IReportTargetResolver } from '@libs/interaction/report/interfaces/report-target-resolver.interface'
import { ReportTargetTypeEnum } from '@libs/interaction/report/report.constant'
import { ReportService } from '@libs/interaction/report/report.service'
import { BusinessErrorCode, SceneTypeEnum } from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 小说章节举报解析器
 * 负责处理小说章节的举报业务逻辑，包括验证章节存在性、解析场景元数据等
 */
@Injectable()
export class WorkNovelChapterReportResolver
  implements IReportTargetResolver, OnModuleInit
{
  /** 目标类型：小说章节 */
  readonly targetType = ReportTargetTypeEnum.NOVEL_CHAPTER

  // 初始化 WorkNovelChapterReportResolver 依赖。
  constructor(private readonly reportService: ReportService) {}

  // 模块初始化时注册解析器到举报服务，使举报服务能够识别并处理小说章节类型的举报请求。
  onModuleInit() {
    this.reportService.registerResolver(this)
  }

  // 解析目标小说章节的场景元数据，验证章节存在性并返回场景类型和场景ID。
  async resolveMeta(tx: Db, targetId: number) {
    const chapter = await tx.query.workChapter.findFirst({
      where: {
        id: targetId,
        workType: 2,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!chapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '小说章节不存在',
      )
    }

    return {
      sceneType: SceneTypeEnum.NOVEL_CHAPTER,
      sceneId: targetId,
    }
  }
}
