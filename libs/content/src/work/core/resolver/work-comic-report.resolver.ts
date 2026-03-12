import type { PrismaTransactionClientType } from '@libs/base/database'
import { SceneTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  IReportTargetResolver,
  ReportService,
  ReportTargetTypeEnum,
} from '@libs/interaction/report'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'

/**
 * 漫画作品举报解析器
 * 负责处理漫画作品的举报业务逻辑，包括验证作品存在性、解析场景元数据等
 */
@Injectable()
export class WorkComicReportResolver
  extends BaseService
  implements IReportTargetResolver, OnModuleInit
{
  /** 目标类型：漫画作品 */
  readonly targetType = ReportTargetTypeEnum.COMIC

  constructor(private readonly reportService: ReportService) {
    super()
  }

  /**
   * 模块初始化时注册解析器到举报服务
   * 使举报服务能够识别并处理漫画作品类型的举报请求
   */
  onModuleInit() {
    this.reportService.registerResolver(this)
  }

  /**
   * 解析目标漫画作品的场景元数据
   * 验证作品存在性并返回场景类型和场景ID
   * @param tx - Prisma 事务客户端
   * @param targetId - 作品ID
   * @returns 包含场景类型和场景ID的元数据对象
   * @throws NotFoundException 当作品不存在时抛出异常
   */
  async resolveMeta(tx: PrismaTransactionClientType, targetId: number) {
    const work = await tx.work.findFirst({
      where: {
        id: targetId,
        type: 1,
        deletedAt: null,
      },
      select: { id: true },
    })

    if (!work) {
      throw new NotFoundException('漫画作品不存在')
    }

    return {
      sceneType: SceneTypeEnum.COMIC_WORK,
      sceneId: targetId,
    }
  }
}
