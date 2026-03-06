import { AuditStatusEnum, InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { SensitiveWordLevelEnum } from '@libs/sensitive-word/sensitive-word-constant'
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import { SystemConfigService } from '@libs/system-config'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { CommentPermissionService } from './comment-permission.service'
import {
  CreateCommentDto,
  QueryCommentPageDto,
  QueryCommentRepliesDto,
  QueryMyCommentPageDto,
  ReplyCommentDto,
  UpdateCommentAuditDto,
  UpdateCommentHiddenDto,
} from './dto/comment.dto'

@Injectable()
export class CommentService extends BaseService {
  constructor(
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly systemConfigService: SystemConfigService,
    private readonly commentPermissionService: CommentPermissionService,
  ) {
    super()
  }

  /**
   * 判断评论是否可见（前台展示）
   */
  private isVisible(comment: {
    auditStatus: number
    isHidden: boolean
    deletedAt: Date | null
  }): boolean {
    return (
      comment.auditStatus === AuditStatusEnum.APPROVED &&
      !comment.isHidden &&
      comment.deletedAt === null
    )
  }

  /**
   * 获取目标模型和查询条件
   */
  private getTargetInfo(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
        return {
          model: tx.work,
          where: { id: targetId, type: 1, deletedAt: null },
        }
      case InteractionTargetTypeEnum.NOVEL:
        return {
          model: tx.work,
          where: { id: targetId, type: 2, deletedAt: null },
        }
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
        return {
          model: tx.workChapter,
          where: { id: targetId, workType: 1, deletedAt: null },
        }
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return {
          model: tx.workChapter,
          where: { id: targetId, workType: 2, deletedAt: null },
        }
      case InteractionTargetTypeEnum.FORUM_TOPIC:
        return {
          model: tx.forumTopic,
          where: { id: targetId, deletedAt: null },
        }
    }
  }

  /**
   * 应用评论计数变化
   */
  private async applyCommentCountDelta(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    const { model, where } = this.getTargetInfo(tx, targetType, targetId)
    await model.applyCountDelta(where, 'commentCount', delta)
  }

  /**
   * 根据敏感词和系统配置决定审核策略
   * @param content - 评论内容
   * @returns 审核状态、是否隐藏、敏感词命中信息
   */
  private async resolveAuditDecision(content: string) {
    const result = this.sensitiveWordDetectService.getMatchedWords({ content })
    const config = await this.systemConfigService.findActiveConfig()
    const policy = config?.contentReviewPolicy
    let auditStatus: AuditStatusEnum = AuditStatusEnum.APPROVED
    let isHidden = false

    if (policy && result.highestLevel) {
      if (result.highestLevel === SensitiveWordLevelEnum.SEVERE) {
        auditStatus = policy.severeAction.auditStatus as AuditStatusEnum
        isHidden = policy.severeAction.isHidden ?? false
      } else if (result.highestLevel === SensitiveWordLevelEnum.GENERAL) {
        auditStatus = policy.generalAction.auditStatus as AuditStatusEnum
        isHidden = policy.generalAction.isHidden ?? false
      } else {
        auditStatus = policy.lightAction.auditStatus as AuditStatusEnum
        isHidden = policy.lightAction.isHidden ?? false
      }
    }

    return {
      auditStatus,
      isHidden,
      sensitiveWordHits: result.hits?.length
        ? JSON.stringify(result.hits)
        : undefined,
    }
  }

  /**
   * 创建评论（根评论）
   * @param dto - 创建评论相关的参数
   * @returns 新创建的评论
   */
  async createComment(dto: CreateCommentDto) {
    const { userId, targetType, targetId, content } = dto
    await this.commentPermissionService.ensureCanComment(
      userId,
      targetType,
      targetId,
    )

    const decision = await this.resolveAuditDecision(content)

    const result = await this.prisma.userComment.aggregate({
      where: {
        targetType,
        targetId,
        replyToId: null,
      },
      _max: { floor: true },
    })
    const floor = (result._max.floor ?? 0) + 1

    return this.prisma.$transaction(async (tx) => {
      const newComment = await tx.userComment.create({
        data: {
          targetType,
          targetId,
          userId,
          content,
          floor,
          ...decision,
        },
      })

      if (this.isVisible({ ...decision, deletedAt: null })) {
        await this.applyCommentCountDelta(tx, targetType, targetId, 1)
      }

      return { id: newComment.id }
    })
  }

  /**
   * 回复评论
   * @param dto - 回复评论相关的参数
   * @returns 新创建的回复
   */
  async replyComment(dto: ReplyCommentDto) {
    const { userId, content, replyToId } = dto

    const replyTo = await this.prisma.userComment.findUnique({
      where: { id: replyToId },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        replyToId: true,
        actualReplyToId: true,
        deletedAt: true,
      },
    })
    if (!replyTo || replyTo.deletedAt) {
      throw new BadRequestException('回复目标不存在')
    }

    const { targetType, targetId } = replyTo
    await this.commentPermissionService.ensureCanComment(
      userId,
      targetType as InteractionTargetTypeEnum,
      targetId,
    )

    const actualReplyToId = replyTo.replyToId
      ? (replyTo.actualReplyToId ?? replyTo.id)
      : replyTo.id

    const decision = await this.resolveAuditDecision(content)

    return this.prisma.$transaction(async (tx) => {
      const newComment = await tx.userComment.create({
        data: {
          targetType,
          targetId,
          userId,
          content,
          replyToId,
          actualReplyToId,
          ...decision,
        },
      })

      if (this.isVisible({ ...decision, deletedAt: null })) {
        await this.applyCommentCountDelta(
          tx,
          targetType as InteractionTargetTypeEnum,
          targetId,
          1,
        )
      }

      return { id: newComment.id }
    })
  }

  /**
   * 删除评论
   * @param commentId - 评论ID
   * @param userId - 用户ID（可选，不传则表示管理员操作）
   */
  async deleteComment(commentId: number, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const where = userId ? { id: commentId, userId } : { id: commentId }
      const result = await tx.userComment.softDelete(where)

      if (!this.isVisible({ ...result, deletedAt: null })) {
        return { id: result.id }
      }

      await this.applyCommentCountDelta(
        tx,
        result.targetType as InteractionTargetTypeEnum,
        result.targetId,
        -1,
      )
      return { id: result.id }
    })
  }

  /**
   * 获取评论的回复列表
   * @param dto - 筛选参数
   * @returns 分页回复列表
   */
  async getReplies(dto: QueryCommentRepliesDto) {
    const { commentId, ...otherDto } = dto
    return this.prisma.userComment.findPagination({
      where: {
        actualReplyToId: commentId,
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
        deletedAt: null,
        ...otherDto,
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    })
  }

  /**
   * 获取评论管理分页列表
   * @param query - 查询参数
   * @returns 分页评论列表
   */
  async getCommentManagePage(query: QueryCommentPageDto) {
    const { rootOnly = false, ...otherDto } = query

    return this.prisma.userComment.findPagination({
      where: {
        ...(rootOnly && { replyToId: null }),
        deletedAt: null,
        ...otherDto,
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    })
  }

  /**
   * 获取评论详情
   * @param commentId - 评论ID
   * @returns 评论详情
   * @throws NotFoundException 评论不存在时抛出
   */
  async getCommentDetail(commentId: number) {
    const comment = await this.prisma.userComment.findUnique({
      where: { id: commentId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
        replyTo: {
          select: {
            user: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
      },
    })

    if (!comment) {
      throw new NotFoundException('未找到相关评论')
    }

    return comment
  }

  /**
   * 更新评论审核状态
   * @param dto - 审核参数
   * @returns 操作结果
   */
  async updateCommentAudit(dto: UpdateCommentAuditDto) {
    await this.prisma.$transaction(async (tx) => {
      const comment = await tx.userComment.findUnique({
        where: { id: dto.commentId, deletedAt: null },
        select: {
          targetType: true,
          targetId: true,
          auditStatus: true,
          isHidden: true,
          deletedAt: true,
        },
      })
      if (!comment) {
        throw new NotFoundException('未找到相关评论')
      }

      const beforeVisible = this.isVisible(comment)

      const { commentId, ...otherDto } = dto
      const updated = await tx.userComment.update({
        where: { id: commentId, deletedAt: null },
        data: {
          ...otherDto,
          auditAt: new Date(),
        },
        select: {
          targetType: true,
          targetId: true,
          auditStatus: true,
          isHidden: true,
          deletedAt: true,
        },
      })

      const afterVisible = this.isVisible(updated)
      if (beforeVisible !== afterVisible) {
        await this.applyCommentCountDelta(
          tx,
          updated.targetType as InteractionTargetTypeEnum,
          updated.targetId,
          afterVisible ? 1 : -1,
        )
      }
    })

    return { id: dto.commentId }
  }

  /**
   * 更新评论隐藏状态
   * @param dto - 隐藏参数
   * @returns 操作结果
   */
  async updateCommentHidden(dto: UpdateCommentHiddenDto) {
    await this.prisma.$transaction(async (tx) => {
      if (
        !(await tx.userComment.exists({ id: dto.commentId, deletedAt: null }))
      ) {
        throw new NotFoundException('未找到相关评论')
      }

      const updated = await tx.userComment.update({
        where: { id: dto.commentId, deletedAt: null },
        data: { isHidden: dto.isHidden },
        select: {
          targetType: true,
          targetId: true,
          isHidden: true,
          auditStatus: true,
          deletedAt: true,
        },
      })

      const beforeVisible = this.isVisible({
        auditStatus: updated.auditStatus,
        isHidden: !dto.isHidden,
        deletedAt: updated.deletedAt,
      })
      const afterVisible = this.isVisible(updated)

      if (beforeVisible !== afterVisible) {
        await this.applyCommentCountDelta(
          tx,
          updated.targetType as InteractionTargetTypeEnum,
          updated.targetId,
          afterVisible ? 1 : -1,
        )
      }
    })

    return { id: dto.commentId }
  }

  /**
   * 获取用户的评论列表
   * @param dto - 筛选参数
   * @param userId - 用户ID
   * @returns 分页评论列表
   */
  async getUserComments(dto: QueryMyCommentPageDto, userId: number) {
    return this.prisma.userComment.findPagination({
      where: {
        userId,
        deletedAt: null,
        ...dto,
      },
    })
  }
}
