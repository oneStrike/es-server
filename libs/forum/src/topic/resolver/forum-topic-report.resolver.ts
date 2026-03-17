import {
  InteractionTx,
  IReportTargetResolver,
  ReportService,
  ReportTargetTypeEnum,
} from '@libs/interaction'
import { SceneTypeEnum } from '@libs/platform/constant'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'

/**
 * 论坛主题举报解析器
 * 负责处理论坛主题的举报业务逻辑，包括验证主题存在性、解析场景元数据、返回主题作者ID等
 */
@Injectable()
export class ForumTopicReportResolver
  implements IReportTargetResolver, OnModuleInit
{
  /** 目标类型：论坛主题 */
  readonly targetType = ReportTargetTypeEnum.FORUM_TOPIC

  constructor(private readonly reportService: ReportService) {}

  /**
   * 模块初始化时注册解析器到举报服务
   * 使举报服务能够识别并处理论坛主题类型的举报请求
   */
  onModuleInit() {
    this.reportService.registerResolver(this)
  }

  /**
   * 解析目标主题的场景元数据
   * 验证主题存在性并返回场景类型、场景ID和主题作者ID
   * @param tx - 事务客户端
   * @param targetId - 主题ID
   * @returns 包含场景类型、场景ID和主题作者的元数据对象
   * @throws NotFoundException 当主题不存在时抛出异常
   */
  async resolveMeta(tx: InteractionTx, targetId: number) {
    const topic = await tx.query.forumTopic.findFirst({
      where: {
        id: targetId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        userId: true,
      },
    })

    if (!topic) {
      throw new NotFoundException('帖子不存在')
    }

    return {
      sceneType: SceneTypeEnum.FORUM_TOPIC,
      sceneId: targetId,
      ownerUserId: topic.userId,
    }
  }
}
