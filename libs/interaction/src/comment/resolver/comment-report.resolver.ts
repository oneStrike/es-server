import type { Db } from '@db/core'
import type { ReportDispositionResult } from '../../report/interfaces/report-target-resolver.type'

import {
  AuditRoleEnum,
  AuditStatusEnum,
  BusinessErrorCode,
  CommentLevelEnum,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { IReportTargetResolver } from '../../report/interfaces/report-target-resolver.type'
import {
  ReportDispositionActionEnum,
  ReportTargetTypeEnum,
} from '../../report/report.constant'
import { ReportService } from '../../report/report.service'
import {
  mapCommentTargetTypeToSceneType,
} from '../comment.constant'
import { CommentService } from '../comment.service'

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

  constructor(
    private readonly reportService: ReportService,
    private readonly commentService: CommentService,
  ) {}

  // 模块初始化时注册解析器到举报服务 使举报服务能够识别并处理评论类型的举报请求
  onModuleInit() {
    this.reportService.registerResolver(this)
  }

  // 解析目标评论的场景元数据 验证评论存在性，根据评论挂载的目标类型和回复关系确定场景类型和评论层级
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '评论不存在',
      )
    }

    const sceneType = mapCommentTargetTypeToSceneType(
      comment.targetType,
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

  async applyDisposition(
    tx: Db,
    input: {
      reportId: number
      targetId: number
      action: ReportDispositionActionEnum
      reason?: string | null
      actorUserId: number
    },
  ): Promise<ReportDispositionResult> {
    const current = await tx.query.userComment.findFirst({
      where: { id: input.targetId, deletedAt: { isNull: true } },
      columns: {
        id: true,
        userId: true,
        targetType: true,
        targetId: true,
        replyToId: true,
        content: true,
        createdAt: true,
        auditStatus: true,
        auditReason: true,
        isHidden: true,
        deletedAt: true,
      },
    })

    if (!current) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '评论不存在',
      )
    }

    if (input.action === ReportDispositionActionEnum.HIDE_COMMENT) {
      const handled = await this.commentService.updateCommentHiddenInTx(
        tx,
        {
          id: input.targetId,
          isHidden: true,
        },
        current,
      )

      return {
        applied: true,
        statusBefore: { isHidden: current.isHidden },
        statusAfter: { isHidden: true },
        message: handled.changed ? '评论已隐藏' : '评论已处于隐藏状态',
        eventEnvelope: handled.eventEnvelope,
        rewardComment: handled.rewardComment,
      }
    }

    if (input.action === ReportDispositionActionEnum.REJECT_COMMENT) {
      const handled = await this.commentService.updateCommentAuditStatusInTx(
        tx,
        {
          id: input.targetId,
          auditStatus: AuditStatusEnum.REJECTED,
          auditReason: input.reason ?? undefined,
          auditById: input.actorUserId,
          auditRole: AuditRoleEnum.ADMIN,
        },
        current,
      )

      return {
        applied: true,
        statusBefore: {
          auditStatus: current.auditStatus,
          auditReason: current.auditReason ?? null,
        },
        statusAfter: {
          auditStatus: AuditStatusEnum.REJECTED,
          auditReason: input.reason ?? null,
        },
        message: handled.changed ? '评论已拒绝' : '评论已处于拒绝状态',
        eventEnvelope: handled.eventEnvelope,
        rewardComment: handled.rewardComment,
      }
    }

    throw new BadRequestException('评论举报不支持该处置动作')
  }

  async postDispositionCommit(result: ReportDispositionResult) {
    await this.commentService.rewardCommentModerationIfNeeded({
      eventEnvelope: result.eventEnvelope ?? null,
      rewardComment:
        (result.rewardComment as Parameters<
          CommentService['rewardCommentModerationIfNeeded']
        >[0]['rewardComment']) ?? null,
    })
  }
}
