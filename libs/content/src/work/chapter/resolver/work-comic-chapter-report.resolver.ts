import type { Db } from '@db/core'
import { IReportTargetResolver } from '@libs/interaction/report/interfaces/report-target-resolver.interface'
import { ReportTargetTypeEnum } from '@libs/interaction/report/report.constant'
import { ReportService } from '@libs/interaction/report/report.service'
import { BusinessErrorCode, SceneTypeEnum } from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 漫画章节举报解析器
 * 负责处理漫画章节的举报业务逻辑，包括验证章节存在性、解析场景元数据等
 */
@Injectable()
export class WorkComicChapterReportResolver
  implements IReportTargetResolver, OnModuleInit
{
  /** 目标类型：漫画章节 */
  readonly targetType = ReportTargetTypeEnum.COMIC_CHAPTER

  constructor(private readonly reportService: ReportService) {}

  /**
   * 模块初始化时注册解析器到举报服务
   * 使举报服务能够识别并处理漫画章节类型的举报请求
   */
  onModuleInit() {
    this.reportService.registerResolver(this)
  }

  /**
   * 解析目标漫画章节的场景元数据
   * 验证章节存在性并返回场景类型和场景ID
   * @param tx - 事务客户端
   * @param targetId - 章节ID
   * @returns 包含场景类型和场景ID的元数据对象
   * @throws BusinessException 当章节不存在时抛出异常
   */
  async resolveMeta(tx: Db, targetId: number) {
    const chapter = await tx.query.workChapter.findFirst({
      where: {
        id: targetId,
        workType: 1,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!chapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '漫画章节不存在',
      )
    }

    return {
      sceneType: SceneTypeEnum.COMIC_CHAPTER,
      sceneId: targetId,
    }
  }
}
