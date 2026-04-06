import type { Db } from '@db/core'
import { CommentLevelEnum } from '@libs/platform/constant/interaction.constant';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { IReportTargetResolver } from '../../report/interfaces/report-target-resolver.interface';
import { ReportTargetTypeEnum } from '../../report/report.constant';
import { ReportService } from '../../report/report.service';
import {
  CommentTargetTypeEnum,
  mapCommentTargetTypeToSceneType,
} from '../comment.constant'

/**
 * 评论举报解析器
 * 负责处理评论的举报业务逻辑，包括验证评论存在性、解析场景元数据（区分根评论和回复）、
 * 返回评论作者ID以便拦截自举报等
 */
@Injectable()
export class CommentReportResolver
  implements IReportTargetResolver, OnModuleInit
{
  /** 目标类型：评论 */
  readonly targetType = ReportTargetTypeEnum.COMMENT

  constructor(private readonly reportService: ReportService) {}

  /**
   * 模块初始化时注册解析器到举报服务
   * 使举报服务能够识别并处理评论类型的举报请求
   */
  onModuleInit() {
    this.reportService.registerResolver(this)
  }

  /**
   * 解析目标评论的场景元数据
   * 验证评论存在性，根据评论挂载的目标类型和回复关系确定场景类型和评论层级
   * @param tx - 事务客户端
   * @param targetId - 评论ID
   * @returns 包含场景类型、场景ID、评论层级和评论作者的元数据对象
   * @throws NotFoundException 当评论不存在时抛出异常
   * @throws BadRequestException 当评论挂载的目标类型不合法时抛出异常
   */
  async resolveMeta(tx: Db, targetId: number) {
    const comment = await tx.query.userComment.findFirst({
      where: { id: targetId, deletedAt: { isNull: true } },
      columns: {
        id: true,
        userId: true,
        targetType: true,
        targetId: true,
        replyToId: true,
      },
    })

    if (!comment) {
      throw new NotFoundException('评论不存在')
    }

    const sceneType = mapCommentTargetTypeToSceneType(
      comment.targetType as CommentTargetTypeEnum,
    )
    if (!sceneType) {
      throw new BadRequestException('评论挂载的目标类型不合法')
    }

    const commentLevel = comment.replyToId
      ? CommentLevelEnum.REPLY
      : CommentLevelEnum.ROOT

    return {
      sceneType,
      sceneId: comment.targetId,
      commentLevel,
      ownerUserId: comment.userId,
    }
  }
}
