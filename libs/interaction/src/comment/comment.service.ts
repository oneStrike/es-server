import {
  AuditRoleEnum,
  AuditStatusEnum,
  InteractionTargetTypeEnum,
} from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { SensitiveWordLevelEnum } from '@libs/sensitive-word/sensitive-word-constant'
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import { SystemConfigService } from '@libs/system-config'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { CommentCountService } from './comment-count.service'
import { CommentPermissionService } from './comment-permission.service'
import {
  CreateCommentDto,
  QueryCommentPageDto,
  QueryCommentRepliesDto,
  QueryMyCommentPageDto,
  ReplyCommentDto,
  UpdateCommentAuditDto,
} from './dto/comment.dto'

@Injectable()
export class CommentService extends BaseService {
  constructor(
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly systemConfigService: SystemConfigService,
    private readonly commentPermissionService: CommentPermissionService,
    private readonly commentCountService: CommentCountService,
  ) {
    super()
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

      if (
        this.commentCountService.isVisible({
          auditStatus: decision.auditStatus,
          isHidden: decision.isHidden,
          deletedAt: null,
        })
      ) {
        await this.commentCountService.applyCommentCountDelta(
          tx,
          targetType,
          targetId,
          1,
        )
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

      if (
        this.commentCountService.isVisible({
          auditStatus: decision.auditStatus,
          isHidden: decision.isHidden,
          deletedAt: null,
        })
      ) {
        await this.commentCountService.applyCommentCountDelta(
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

      const beforeVisible = this.commentCountService.isVisible({
        auditStatus: result.auditStatus,
        isHidden: result.isHidden,
        deletedAt: null,
      })

      if (!beforeVisible) {
        return { id: result.id }
      }

      await this.commentCountService.applyCommentCountDelta(
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
   * @param body - 审核参数
   * @param operatorId - 操作人ID
   * @returns 操作结果
   */
  async updateCommentAudit(body: UpdateCommentAuditDto, operatorId: number) {
    await this.prisma.$transaction(async (tx) => {
      const comment = await tx.userComment.findUnique({
        where: { id: body.commentId, deletedAt: null },
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

      const beforeVisible = this.commentCountService.isVisible(comment)

      let updated: {
        targetType: number
        targetId: number
        auditStatus: number
        isHidden: boolean
        deletedAt: Date | null
      }

      try {
        updated = await tx.userComment.update({
          where: { id: body.commentId, deletedAt: null },
          data: {
            auditStatus: body.auditStatus,
            auditReason: body.auditReason,
            auditById: operatorId,
            auditRole: AuditRoleEnum.ADMIN,
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
      } catch (error) {
        if (this.isRecordNotFound(error)) {
          throw new NotFoundException('Comment not found')
        }
        throw error
      }

      const afterVisible = this.commentCountService.isVisible(updated)
      await this.commentCountService.syncVisibleCountByTransition(
        tx,
        updated.targetType as InteractionTargetTypeEnum,
        updated.targetId,
        beforeVisible,
        afterVisible,
      )
    })

    return { success: true }
  }

  /**
   * 更新评论隐藏状态
   * @param body - 隐藏参数
   * @returns 操作结果
   */
  async updateCommentHidden(body: { commentId: number, isHidden: boolean }) {
    await this.prisma.$transaction(async (tx) => {
      let updated: {
        targetType: number
        targetId: number
        auditStatus: number
        isHidden: boolean
        deletedAt: Date | null
      }

      try {
        updated = await tx.userComment.update({
          where: { id: body.commentId, deletedAt: null },
          data: { isHidden: body.isHidden },
          select: {
            targetType: true,
            targetId: true,
            auditStatus: true,
            isHidden: true,
            deletedAt: true,
          },
        })
      } catch (error) {
        if (this.isRecordNotFound(error)) {
          throw new NotFoundException('Comment not found')
        }
        throw error
      }

      const beforeVisible = this.commentCountService.isVisible({
        auditStatus: updated.auditStatus,
        isHidden: !body.isHidden,
        deletedAt: updated.deletedAt,
      })
      const afterVisible = this.commentCountService.isVisible(updated)

      await this.commentCountService.syncVisibleCountByTransition(
        tx,
        updated.targetType as InteractionTargetTypeEnum,
        updated.targetId,
        beforeVisible,
        afterVisible,
      )
    })

    return { success: true }
  }

  /**
   * 重新计算评论数量
   * @param targetType - 目标类型
   * @param targetId - 目标ID
   * @returns 计算结果
   */
  async recalcCommentCount(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    const count = await this.prisma.userComment.count({
      where: {
        targetType,
        targetId,
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
        deletedAt: null,
      },
    })

    await this.commentCountService.setCommentCount(targetType, targetId, count)
    return { targetType, targetId, commentCount: count }
  }

  /**
   * 获取用户的评论列表
   * @param userId - 用户ID
   * @param dto - 筛选参数
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
