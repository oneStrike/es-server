import type { Db } from '@db/core'
import { IReportTargetResolver } from '@libs/interaction/report/interfaces/report-target-resolver.interface'
import { ReportTargetTypeEnum } from '@libs/interaction/report/report.constant'
import { ReportService } from '@libs/interaction/report/report.service'
import { BusinessErrorCode, SceneTypeEnum } from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 小说作品举报解析器
 * 负责处理小说作品的举报业务逻辑，包括验证作品存在性、解析场景元数据等
 */
@Injectable()
export class WorkNovelReportResolver
  implements IReportTargetResolver, OnModuleInit
{
  /** 目标类型：小说作品 */
  readonly targetType = ReportTargetTypeEnum.NOVEL

  constructor(private readonly reportService: ReportService) {}

  /**
   * 模块初始化时注册解析器到举报服务
   * 使举报服务能够识别并处理小说作品类型的举报请求
   */
  onModuleInit() {
    this.reportService.registerResolver(this)
  }

  /**
   * 解析目标小说作品的场景元数据
   * 验证作品存在性并返回场景类型和场景ID
   * @param tx - 事务客户端
   * @param targetId - 作品ID
   * @returns 包含场景类型和场景ID的元数据对象
   * @throws BusinessException 当作品不存在时抛出异常
   */
  async resolveMeta(tx: Db, targetId: number) {
    const work = await tx.query.work.findFirst({
      where: {
        id: targetId,
        type: 2,
        isPublished: true,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!work) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '小说作品不存在',
      )
    }

    return {
      sceneType: SceneTypeEnum.NOVEL_WORK,
      sceneId: targetId,
    }
  }
}
