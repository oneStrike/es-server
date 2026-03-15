import {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import {
  AuditStatusEnum,
} from '@libs/platform/constant'
import { PlatformService, Prisma } from '@libs/platform/database'
import {
  SensitiveWordDetectService,
  SensitiveWordLevelEnum,
} from '@libs/sensitive-word'

import { ConfigReader } from '@libs/system-config'
import { BadRequestException, Injectable } from '@nestjs/common'
import { CommentGrowthService } from './comment-growth.service'
import { CommentPermissionService } from './comment-permission.service'
import { CommentTargetTypeEnum } from './comment.constant'
import {
  CreateCommentDto,
  QueryCommentRepliesDto,
  QueryMyCommentPageDto,
  ReplyCommentDto,
} from './dto/comment.dto'
import {
  CommentTargetMeta,
  ICommentTargetResolver,
} from './interfaces/comment-target-resolver.interface'

/**
 * 可见评论的载荷数据结构
 * 用于补偿效应处理时传递评论的核心信息
 */
interface VisibleCommentPayload {
  id: number
  userId: number
  targetType: number
  targetId: number
  replyToId: number | null
  createdAt: Date
}

/**
 * 评论服务
 *
 * 提供评论的创建、回复、删除、查询等核心功能。
 * 集成了敏感词检测、审核决策、成长奖励、消息通知等功能。
 */
@Injectable()
export class CommentService extends PlatformService {
  constructor(
    /** 敏感词检测服务，用于内容审核 */
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    /** 配置读取器，获取审核策略等配置 */
    private readonly configReader: ConfigReader,
    /** 评论权限服务，校验用户评论权限 */
    private readonly commentPermissionService: CommentPermissionService,
    /** 评论成长服务，处理评论相关的积分/经验奖励 */
    private readonly commentGrowthService: CommentGrowthService,
    /** 消息发件箱服务，用于发送通知消息 */
    private readonly messageOutboxService: MessageOutboxService,
  ) {
    super()
  }

  /** 目标类型到解析器的映射表 */
  private readonly resolvers = new Map<
    CommentTargetTypeEnum,
    ICommentTargetResolver
  >()

  /**
   * 注册目标解析器
   * @param resolver - 评论目标解析器实例
   */
  registerResolver(resolver: ICommentTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `Comment resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  /**
   * 获取指定目标类型的解析器
   * @param targetType - 评论目标类型
   * @returns 对应的目标解析器
   */
  getResolver(targetType: CommentTargetTypeEnum): ICommentTargetResolver {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BadRequestException('不支持的评论目标类型')
    }
    return resolver
  }

  /**
   * 判断评论是否对用户可见
   *
   * 可见条件：审核通过 + 未隐藏 + 未删除
   *
   * @param comment 包含审核状态、隐藏标记、删除时间的评论对象
   * @param comment.auditStatus 审核状态
   * @param comment.isHidden 是否隐藏
   * @param comment.deletedAt 删除时间
   * @returns 是否可见
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
   * 应用评论数量变更到目标对象
   *
   * 更新目标对象（如漫画、小说等）的评论计数字段。
   * 当 delta 为 0 时跳过操作。
   *
   * @param tx - Prisma 事务客户端
   * @param targetType - 目标类型（漫画、小说等）
   * @param targetId - 目标ID
   * @param delta - 变更量（+1 增加，-1 减少）
   */
  private async applyCommentCountDelta(
    tx: any,
    targetType: CommentTargetTypeEnum,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    const resolver = this.getResolver(targetType)
    await resolver.applyCountDelta(tx, targetId, delta)
  }

  /**
   * 根据敏感词检测结果解析审核决策
   *
   * 根据配置的审核策略，对内容进行敏感词检测，
   * 并根据敏感词级别（严重/一般/轻微）返回对应的审核状态和隐藏标记。
   *
   * @param content - 待检测的评论内容
   * @returns 审核决策结果，包含审核状态、是否隐藏、敏感词命中记录
   */
  private resolveAuditDecision(content: string) {
    // 检测内容中的敏感词
    const result = this.sensitiveWordDetectService.getMatchedWords({ content })
    // 获取内容审核策略配置
    const policy = this.configReader.getContentReviewPolicy()

    // 默认审核通过，不隐藏
    let auditStatus: AuditStatusEnum = AuditStatusEnum.APPROVED
    let isHidden = false

    // 根据敏感词最高级别确定审核决策
    if (result.highestLevel) {
      if (result.highestLevel === SensitiveWordLevelEnum.SEVERE) {
        // 严重敏感词：按策略处理（通常直接拒绝或隐藏）
        auditStatus = policy.severeAction.auditStatus as AuditStatusEnum
        isHidden = policy.severeAction.isHidden
      } else if (result.highestLevel === SensitiveWordLevelEnum.GENERAL) {
        // 一般敏感词：按策略处理（可能需要人工审核）
        auditStatus = policy.generalAction.auditStatus as AuditStatusEnum
        isHidden = policy.generalAction.isHidden
      } else {
        // 轻微敏感词：按策略处理（可能警告或标记）
        auditStatus = policy.lightAction.auditStatus as AuditStatusEnum
        isHidden = policy.lightAction.isHidden
      }
    }

    return {
      auditStatus,
      isHidden,
      // 根据配置决定是否记录命中详情
      sensitiveWordHits:
        policy.recordHits && result.hits?.length
          ? (result.hits as any)
          : undefined,
    }
  }

  /**
   * 补偿可见评论的副作用
   *
   * 当评论变为可见状态时，需要执行以下补偿操作：
   * 1. 给评论者发放成长奖励（积分/经验）
   * 2. 如果是回复评论，向被回复者发送通知
   *
   * @param tx - Prisma 事务客户端
   * @param comment - 可见评论的载荷数据
   */
  private async compensateVisibleCommentEffects(
    tx: any,
    comment: VisibleCommentPayload,
    _meta: CommentTargetMeta,
  ) {
    // 移除成长奖励逻辑，由外部 createComment/replyComment 处理，
    // 因为成长奖励需要传 targetId 等，从 payload 取不如直接传。
    // 这里主要处理通知逻辑。

    // 非回复评论无需发送通知
    if (!comment.replyToId) {
      return
    }

    // 查询被回复的评论，获取被回复者信息
    const replyTarget = await tx.userComment.findUnique({
      where: { id: comment.replyToId, deletedAt: null },
      select: {
        userId: true,
      },
    })

    // 被回复评论不存在或自己回复自己，无需通知
    if (!replyTarget || replyTarget.userId === comment.userId) {
      return
    }

    // 将回复通知加入消息队列
    await this.messageOutboxService.enqueueNotificationEvent(
      {
        eventType: MessageNotificationTypeEnum.COMMENT_REPLY,
        bizKey: `comment:reply:${comment.id}:to:${replyTarget.userId}`,
        payload: {
          receiverUserId: replyTarget.userId,
          actorUserId: comment.userId,
          type: MessageNotificationTypeEnum.COMMENT_REPLY,
          targetType: comment.targetType,
          targetId: comment.targetId,
          subjectType: MessageNotificationSubjectTypeEnum.COMMENT,
          subjectId: comment.id,
          title: '收到新的评论回复',
          content: '你收到了一条新的评论回复',
        },
      },
      tx,
    )

    // 如果目标所有者不是评论者，且不是回复评论（回复通知已发），可以发一个被评论通知
    // 但目前业务可能更细化，暂时保留回复通知逻辑。
    // 如果后续需要添加"作品被评论"通知，可以在这里或 resolver postCommentHook 处理。
  }

  /**
   * 创建一级评论
   *
   * 在目标对象下创建新的评论（非回复）。
   * 自动分配楼层号，进行敏感词审核，并处理可见评论的副作用。
   *
   * 使用 Serializable 隔离级别事务确保楼层号分配的准确性，
   * 并支持冲突重试机制。
   *
   * @param dto - 创建评论参数，包含用户ID、目标类型、目标ID、评论内容
   * @returns 新创建的评论ID
   * @throws BadRequestException - 当权限不足或请求冲突时抛出
   */
  async createComment(dto: CreateCommentDto) {
    const { userId, targetType, targetId, content } = dto

    // 校验用户是否有权限在该目标下评论
    await this.commentPermissionService.ensureCanComment(
      userId,
      targetType,
      targetId,
    )

    // 根据敏感词检测结果确定审核决策
    const decision = this.resolveAuditDecision(content)
    const resolver = this.getResolver(targetType)

    try {
      return await this.withTransactionConflictRetry(
        async () =>
          this.prisma.$transaction(
            async (tx) => {
              // 1. 业务目标校验 (Resolver)
              await resolver.ensureCanComment(tx, targetId)

              // 2. 计算新评论的楼层号（当前最大楼层 + 1）
              const result = await tx.userComment.aggregate({
                where: {
                  targetType,
                  targetId,
                  replyToId: null, // 只统计一级评论
                },
                _max: { floor: true },
              })
              const floor = (result._max.floor ?? 0) + 1

              // 创建评论记录
              const newComment = await tx.userComment.create({
                data: {
                  targetType,
                  targetId,
                  userId,
                  content,
                  floor,
                  ...decision, // 包含审核状态、隐藏标记、敏感词命中记录
                },
                select: {
                  id: true,
                  userId: true,
                  targetType: true,
                  targetId: true,
                  replyToId: true,
                  createdAt: true,
                },
              })

              // 如果评论可见，执行副作用补偿（计数+奖励+通知）
              if (this.isVisible({ ...decision, deletedAt: null })) {
                await this.applyCommentCountDelta(tx, targetType, targetId, 1)

                // 发放成长奖励
                await this.commentGrowthService.rewardCommentCreated(tx, {
                  userId: newComment.userId,
                  commentId: newComment.id,
                  targetType: newComment.targetType,
                  targetId: newComment.targetId,
                  occurredAt: newComment.createdAt,
                })

                // 解析目标元信息用于后置钩子（如通知）
                const meta = await resolver.resolveMeta(tx, targetId)
                if (resolver.postCommentHook) {
                  await resolver.postCommentHook(tx, targetId, userId, meta)
                }

                // 处理通用副作用（如回复通知）
                await this.compensateVisibleCommentEffects(tx, newComment, meta)
              }

              return { id: newComment.id }
            },
            {
              // 使用 Serializable 隔离级别防止楼层号并发冲突
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
          ),
        {
          maxRetries: 3,
        },
      )
    } catch (error) {
      this.handlePrismaBusinessError(error, {
        conflictMessage: '请求冲突，请稍后重试',
      })
    }
  }

  /**
   * 回复评论
   *
   * 对已有评论进行回复。
   * 自动处理回复链（actualReplyToId 指向一级评论），
   * 进行敏感词审核，并处理可见回复的副作用。
   *
   * @param dto - 回复评论参数，包含用户ID、评论内容、被回复评论ID
   * @returns 新创建的回复ID
   * @throws BadRequestException - 当被回复的评论不存在时抛出
   */
  async replyComment(dto: ReplyCommentDto) {
    const { userId, content, replyToId } = dto

    // 查询被回复的评论
    const replyTo = await this.prisma.userComment.findUnique({
      where: { id: replyToId },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        userId: true,
        replyToId: true,
        actualReplyToId: true,
        deletedAt: true,
      },
    })

    // 校验被回复评论是否存在
    if (!replyTo || replyTo.deletedAt) {
      throw new BadRequestException('回复目标不存在')
    }

    const { targetType, targetId } = replyTo

    // 校验用户是否有权限在该目标下评论
    await this.commentPermissionService.ensureCanComment(
      userId,
      targetType as CommentTargetTypeEnum,
      targetId,
    )

    // 计算实际回复目标：
    // 如果回复的是一级评论，actualReplyToId 指向该评论
    // 如果回复的是楼中楼，actualReplyToId 指向一级评论（实现扁平化回复）
    const actualReplyToId = replyTo.replyToId
      ? (replyTo.actualReplyToId ?? replyTo.id)
      : replyTo.id

    // 根据敏感词检测结果确定审核决策
    const decision = this.resolveAuditDecision(content)
    const resolver = this.getResolver(targetType as CommentTargetTypeEnum)

    return this.prisma.$transaction(async (tx) => {
      // 1. 业务目标校验 (Resolver)
      await resolver.ensureCanComment(tx, targetId)

      // 创建回复记录
      const newComment = await tx.userComment.create({
        data: {
          targetType,
          targetId,
          userId,
          content,
          replyToId, // 直接回复的评论ID
          actualReplyToId, // 实际归属的一级评论ID
          ...decision,
        },
        select: {
          id: true,
          userId: true,
          targetType: true,
          targetId: true,
          replyToId: true,
          createdAt: true,
        },
      })

      // 如果回复可见，执行副作用补偿（计数+奖励+通知）
      if (this.isVisible({ ...decision, deletedAt: null })) {
        await this.applyCommentCountDelta(
          tx,
          targetType as CommentTargetTypeEnum,
          targetId,
          1,
        )

        // 发放成长奖励
        await this.commentGrowthService.rewardCommentCreated(tx, {
          userId: newComment.userId,
          commentId: newComment.id,
          targetType: newComment.targetType as any,
          targetId: newComment.targetId,
          occurredAt: newComment.createdAt,
        })

        // 解析目标元信息用于后置钩子
        const meta = await resolver.resolveMeta(tx, targetId)
        if (resolver.postCommentHook) {
          await resolver.postCommentHook(tx, targetId, userId, meta)
        }

        // 处理通用副作用（如回复通知）
        await this.compensateVisibleCommentEffects(tx, newComment, meta)
      }

      return { id: newComment.id }
    })
  }

  /**
   * 删除评论
   *
   * 软删除评论（设置 deletedAt 时间戳）。
   * 如果删除前评论是可见状态，需要减少目标对象的评论计数。
   *
   * @param commentId - 待删除的评论ID
   * @param userId - 可选，指定用户ID时只能删除自己的评论（用户侧调用）
   *                 不指定时可删除任意评论（管理员侧调用）
   * @returns 被删除的评论ID
   */
  async deleteComment(commentId: number, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      // 根据 userId 是否存在决定删除条件（权限控制）
      const where = userId ? { id: commentId, userId } : { id: commentId }

      // 执行软删除
      const result = await tx.userComment.softDelete(where)

      // 如果删除前评论不可见，无需更新计数
      if (!this.isVisible({ ...result, deletedAt: null })) {
        return { id: result.id }
      }

      // 减少目标对象的评论计数
      await this.applyCommentCountDelta(
        tx,
        result.targetType as CommentTargetTypeEnum,
        result.targetId,
        -1,
      )

      return { id: result.id }
    })
  }

  /**
   * 获取评论的回复列表
   *
   * 分页查询指定一级评论下的所有回复（扁平化展示）。
   * 只返回审核通过、未隐藏、未删除的回复。
   *
   * @param dto - 查询参数，包含一级评论ID和分页信息
   * @returns 分页的回复列表，包含用户基本信息
   */
  async getReplies(dto: QueryCommentRepliesDto) {
    const { commentId, ...otherDto } = dto

    return this.prisma.userComment.findPagination({
      where: {
        actualReplyToId: commentId, // 查询归属于该一级评论的所有回复
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
   * 获取用户的评论列表
   *
   * 分页查询指定用户的所有评论（包括回复）。
   * 包含已隐藏和待审核的评论（用户自己的评论需要能看到状态）。
   *
   * @param dto - 查询参数，包含分页信息
   * @param userId - 用户ID
   * @returns 分页的评论列表
   */
  async getUserComments(dto: QueryMyCommentPageDto, userId: number) {
    return this.prisma.userComment.findPagination({
      where: {
        userId,
        deletedAt: null, // 排除已删除的评论
        ...dto,
      },
    })
  }
}
