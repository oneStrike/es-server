import {
  InteractionTx,
  IReportTargetResolver,
  ReportService,
  ReportTargetTypeEnum,
} from '@libs/interaction'
import { SceneTypeEnum } from '@libs/platform/constant'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'

/**
 * 用户举报解析器
 * 负责处理用户的举报业务逻辑，包括验证用户存在性、解析场景元数据等
 */
@Injectable()
export class UserReportResolver implements IReportTargetResolver, OnModuleInit {
  /** 目标类型：用户 */
  readonly targetType = ReportTargetTypeEnum.USER

  constructor(private readonly reportService: ReportService) {}

  /**
   * 模块初始化时注册解析器到举报服务
   * 使举报服务能够识别并处理用户类型的举报请求
   */
  onModuleInit() {
    this.reportService.registerResolver(this)
  }

  /**
   * 解析目标用户的场景元数据
   * 验证用户存在性并返回场景类型和场景ID
   * @param tx - 事务客户端
   * @param targetId - 用户ID
   * @returns 包含场景类型、场景ID和用户ID的元数据对象
   * @throws NotFoundException 当用户不存在时抛出异常
   */
  async resolveMeta(tx: InteractionTx, targetId: number) {
    const user = await tx.query.appUser.findFirst({
      where: { id: targetId, deletedAt: { isNull: true } },
      columns: { id: true },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return {
      sceneType: SceneTypeEnum.USER_PROFILE,
      sceneId: targetId,
      ownerUserId: targetId,
    }
  }
}
