import type { Db } from '@db/core'
import type { SQL } from 'drizzle-orm'
import type {
  CommentModerationState,
  CommentVisibleState,
  TransactionRetryOptions,
  VisibleCommentEffectPayload,
} from './comment.type'
import { buildILikeCondition, DrizzleService } from '@db/core'
import {
  canConsumeEventEnvelopeByConsumer,
  createDefinedEventEnvelope,
  EventDefinitionConsumerEnum,
  EventEnvelopeGovernanceStatusEnum,
} from '@libs/growth/event-definition'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { MessageNotificationComposerService } from '@libs/message/notification'
import { MessageOutboxService } from '@libs/message/outbox'
import { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant'
import {
  SensitiveWordDetectService,
  SensitiveWordLevelEnum,
} from '@libs/sensitive-word'
import { ConfigReader } from '@libs/system-config'
import { AppUserCountService } from '@libs/user/core'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, inArray, isNull, lte, max, sql } from 'drizzle-orm'
import { EmojiParserService, EmojiSceneEnum } from '../emoji'
import { LikeTargetTypeEnum } from '../like/like.constant'
import { LikeService } from '../like/like.service'
import { CommentGrowthService } from './comment-growth.service'
import { CommentPermissionService } from './comment-permission.service'
import { CommentTargetTypeEnum } from './comment.constant'
import {
  CreateCommentBodyDto,
  QueryAdminCommentPageDto,
  QueryCommentRepliesDto,
  QueryMyCommentPageDto,
  QueryTargetCommentsDto,
  ReplyCommentBodyDto,
  UpdateAdminCommentAuditStatusDto,
  UpdateAdminCommentHiddenDto,
} from './dto/comment.dto'
import {
  CommentTargetMeta,
  ICommentTargetResolver,
} from './interfaces/comment-target-resolver.interface'

/**
 * 评论服务
 *
 * 提供评论的创建、回复、删除、查询等核心功能。
 * 集成了敏感词检测、审核决策、成长奖励、消息通知等功能。
 */
@Injectable()
export class CommentService {
  constructor(
    /** 敏感词检测服务，用于内容审核 */
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    /** 配置读取器，获取审核策略等配置 */
    private readonly configReader: ConfigReader,
    /** 评论权限服务，校验用户评论权限 */
    private readonly commentPermissionService: CommentPermissionService,
    /** 评论成长服务，处理评论相关的积分/经验奖励 */
    private readonly commentGrowthService: CommentGrowthService,
    private readonly likeService: LikeService,
    /** 消息发件箱服务，用于发送通知消息 */
    private readonly messageOutboxService: MessageOutboxService,
    private readonly messageNotificationComposerService: MessageNotificationComposerService,
    private readonly appUserCountService: AppUserCountService,
    private readonly emojiParserService: EmojiParserService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get userComment() {
    return this.drizzle.schema.userComment
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  /** 目标类型到解析器的映射表 */
  private readonly resolvers = new Map<
    CommentTargetTypeEnum,
    ICommentTargetResolver
  >()

  /**
   * 事务冲突重试包装器
   *
   * PostgreSQL 在 Serializable 隔离级别下可能因并发冲突抛出序列化失败错误，
   * 此方法自动捕获该错误并重试，适用于楼层号分配等需要严格顺序保证的场景。
   *
   * @param operation - 需要在事务中执行的操作
   * @param options - 重试选项，maxRetries 默认 3 次
   * @returns 操作执行结果
   */
  private async withTransactionConflictRetry<T>(
    operation: () => Promise<T>,
    options?: TransactionRetryOptions,
  ): Promise<T> {
    const maxRetries = Math.max(1, options?.maxRetries ?? 3)
    let lastError: unknown = new Error('事务冲突重试次数已耗尽')

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        if (
          !this.drizzle.isSerializationFailure(error) ||
          attempt >= maxRetries - 1
        ) {
          throw error
        }
      }
    }

    throw lastError
  }

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
  private isVisible(comment: CommentVisibleState) {
    return (
      comment.auditStatus === AuditStatusEnum.APPROVED &&
      !comment.isHidden &&
      comment.deletedAt === null
    )
  }

  /**
   * 将评论审核结果映射为统一事件治理状态。
   * 隐藏或拒绝的评论不进入奖励主链路，待审核评论保留为 pending。
   */
  private resolveCommentGovernanceStatus(params: {
    auditStatus: AuditStatusEnum
    isHidden: boolean
  }) {
    if (params.isHidden || params.auditStatus === AuditStatusEnum.REJECTED) {
      return EventEnvelopeGovernanceStatusEnum.REJECTED
    }
    if (params.auditStatus === AuditStatusEnum.PENDING) {
      return EventEnvelopeGovernanceStatusEnum.PENDING
    }
    return EventEnvelopeGovernanceStatusEnum.PASSED
  }

  /**
   * 构建评论创建事件 envelope。
   * 统一收口 comment create / reply 的目标、治理态和业务上下文。
   */
  private buildCommentCreatedEventEnvelope(params: {
    commentId: number
    userId: number
    targetType: CommentTargetTypeEnum
    targetId: number
    replyToId?: number | null
    occurredAt: Date
    auditStatus: AuditStatusEnum
    isHidden: boolean
  }) {
    return createDefinedEventEnvelope({
      code: GrowthRuleTypeEnum.CREATE_COMMENT,
      subjectId: params.userId,
      targetId: params.commentId,
      occurredAt: params.occurredAt,
      governanceStatus: this.resolveCommentGovernanceStatus({
        auditStatus: params.auditStatus,
        isHidden: params.isHidden,
      }),
      context: {
        commentTargetType: params.targetType,
        commentTargetId: params.targetId,
        replyToId: params.replyToId ?? undefined,
        auditStatus: params.auditStatus,
        isHidden: params.isHidden,
      },
    })
  }

  /**
   * 批量查询评论点赞状态。
   *
   * 仅在登录用户场景下查询，匿名访问统一返回空映射，
   * 由调用方按需兜底为 false，保持响应结构稳定。
   */
  private async getCommentLikedMap(commentIds: number[], userId?: number) {
    if (!userId || commentIds.length === 0) {
      return new Map<number, boolean>()
    }

    return this.likeService.checkStatusBatch(
      LikeTargetTypeEnum.COMMENT,
      commentIds,
      userId,
    )
  }

  /**
   * 应用评论数量变更到目标对象
   *
   * 更新目标对象（如漫画、小说等）的评论计数字段。
   * 当 delta 为 0 时跳过操作。
   *
   * @param tx - 事务客户端
   * @param targetType - 目标类型（漫画、小说等）
   * @param targetId - 目标ID
   * @param delta - 变更量（+1 增加，-1 减少）
   */
  private async applyCommentCountDelta(
    tx: Db,
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
   * 将治理态快照映射为可见副作用载荷。
   * 统一复用 comment create / 审核补偿 / 取消隐藏三类链路的最小字段集。
   */
  private toVisibleCommentEffectPayload(comment: CommentModerationState) {
    return {
      id: comment.id,
      userId: comment.userId,
      targetType: comment.targetType,
      targetId: comment.targetId,
      replyToId: comment.replyToId,
      content: comment.content,
      createdAt: comment.createdAt,
      replyTargetUserId: comment.replyTargetUserId,
    }
  }

  /**
   * 校验评论审核状态更新是否合法。
   * 已进入终态的评论不允许回滚到待审核，避免后台误操作破坏治理事实。
   */
  private ensureCanUpdateCommentAuditStatus(
    currentStatus: AuditStatusEnum,
    nextStatus: AuditStatusEnum,
  ) {
    if (
      currentStatus !== AuditStatusEnum.PENDING &&
      nextStatus === AuditStatusEnum.PENDING
    ) {
      throw new BadRequestException('已审核评论不能回退为待审核')
    }
  }

  /**
   * 同步评论可见性迁移的副作用。
   * - 首次变为可见：补评论计数、目标钩子、回复通知，并回传奖励所需事件壳
   * - 从可见变不可见：回退评论计数与目标派生字段
   */
  private async syncCommentVisibilityTransition(
    tx: Db,
    params: {
      current: CommentModerationState
      nextAuditStatus: AuditStatusEnum
      nextIsHidden: boolean
    },
  ) {
    const wasVisible = this.isVisible(params.current)
    const willBeVisible = this.isVisible({
      auditStatus: params.nextAuditStatus,
      isHidden: params.nextIsHidden,
      deletedAt: params.current.deletedAt,
    })

    if (wasVisible === willBeVisible) {
      return {
        rewardComment: null,
        eventEnvelope: null,
      }
    }

    const targetType = params.current.targetType as CommentTargetTypeEnum
    const resolver = this.getResolver(targetType)
    const meta = await resolver.resolveMeta(tx, params.current.targetId)
    const commentPayload = this.toVisibleCommentEffectPayload(params.current)

    if (!willBeVisible) {
      await this.applyCommentCountDelta(
        tx,
        targetType,
        params.current.targetId,
        -1,
      )

      if (resolver.postDeleteCommentHook) {
        await resolver.postDeleteCommentHook(tx, commentPayload, meta)
      }

      return {
        rewardComment: null,
        eventEnvelope: null,
      }
    }

    await this.applyCommentCountDelta(
      tx,
      targetType,
      params.current.targetId,
      1,
    )

    if (resolver.postCommentHook) {
      await resolver.postCommentHook(tx, commentPayload, meta)
    }

    const commentCreatedEvent = this.buildCommentCreatedEventEnvelope({
      commentId: params.current.id,
      userId: params.current.userId,
      targetType,
      targetId: params.current.targetId,
      replyToId: params.current.replyToId,
      occurredAt: params.current.createdAt,
      auditStatus: params.nextAuditStatus,
      isHidden: params.nextIsHidden,
    })

    await this.compensateVisibleCommentEffects(
      tx,
      commentPayload,
      meta,
      commentCreatedEvent,
    )

    return {
      rewardComment: commentPayload,
      eventEnvelope: commentCreatedEvent,
    }
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
        policy.recordHits && result.hits?.length ? result.hits : undefined,
    }
  }

  /**
   * 补偿可见评论的副作用
   *
   * 当评论变为可见状态时，需要执行以下补偿操作：
   * 1. 给评论者发放成长奖励（积分/经验）
   * 2. 如果是回复评论，向被回复者发送通知
   *
   * @param tx - 事务客户端
   * @param comment - 可见评论的载荷数据
   */
  private async compensateVisibleCommentEffects(
    tx: Db,
    comment: VisibleCommentEffectPayload,
    meta: CommentTargetMeta,
    eventEnvelope: ReturnType<
      CommentService['buildCommentCreatedEventEnvelope']
    >,
  ) {
    // 移除成长奖励逻辑，由外部 createComment/replyComment 处理，
    // 因为成长奖励需要传 targetId 等，从 payload 取不如直接传。
    // 这里主要处理通知逻辑。

    if (
      !canConsumeEventEnvelopeByConsumer(
        eventEnvelope,
        EventDefinitionConsumerEnum.NOTIFICATION,
      )
    ) {
      return
    }

    // 非回复评论无需发送通知
    if (!comment.replyToId) {
      return
    }

    // 查询被回复的评论，获取被回复者信息
    let replyTargetUserId = comment.replyTargetUserId

    if (replyTargetUserId === undefined) {
      const replyTarget = await tx.query.userComment.findFirst({
        where: {
          id: comment.replyToId,
          deletedAt: { isNull: true },
        },
        columns: {
          userId: true,
        },
      })

      replyTargetUserId = replyTarget?.userId
    }

    // 被回复评论不存在或自己回复自己，无需通知
    if (!replyTargetUserId || replyTargetUserId === comment.userId) {
      return
    }

    const actor = await tx.query.appUser.findFirst({
      where: { id: comment.userId },
      columns: { nickname: true },
    })

    // 将回复通知加入消息队列
    await this.messageOutboxService.enqueueNotificationEventInTx(
      tx,
      this.messageNotificationComposerService.buildCommentReplyEvent({
        bizKey: `comment:reply:${comment.id}:to:${replyTargetUserId}`,
        receiverUserId: replyTargetUserId,
        actorUserId: comment.userId,
        targetType: comment.targetType,
        targetId: comment.targetId,
        subjectId: comment.id,
        payload: {
          actorNickname: actor?.nickname,
          replyExcerpt: comment.content,
          targetDisplayTitle: meta.targetDisplayTitle,
        },
      }),
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
   * @param input - 创建评论参数，包含用户ID、目标类型、目标ID、评论内容
   * @returns 新创建的评论ID
   * @throws BadRequestException - 当权限不足或请求冲突时抛出
   */
  async createComment(input: CreateCommentBodyDto & { userId: number }) {
    const { userId, targetType, targetId, content } = input
    const bodyTokens = await this.emojiParserService.parse({
      body: content,
      scene: EmojiSceneEnum.COMMENT,
    })

    // 校验用户是否有权限在该目标下评论
    await this.commentPermissionService.ensureCanComment(
      userId,
      targetType,
      targetId,
    )

    // 根据敏感词检测结果确定审核决策
    const decision = this.resolveAuditDecision(content)
    const resolver = this.getResolver(targetType)

    const created = await this.drizzle.withErrorHandling(
      async () =>
        this.withTransactionConflictRetry(
          async () =>
            this.db.transaction(async (tx) => {
              await resolver.ensureCanComment(tx, targetId)

              const [floorResult] = await tx
                .select({
                  floor: max(this.userComment.floor),
                })
                .from(this.userComment)
                .where(
                  and(
                    eq(this.userComment.targetType, targetType),
                    eq(this.userComment.targetId, targetId),
                    isNull(this.userComment.replyToId),
                  ),
                )
              const floor = (Number(floorResult?.floor ?? 0) || 0) + 1

              const [newComment] = await tx
                .insert(this.userComment)
                .values({
                  targetType,
                  targetId,
                  userId,
                  content,
                  bodyTokens: bodyTokens.length ? bodyTokens : null,
                  floor,
                  ...decision,
                })
                .returning({
                  id: this.userComment.id,
                  userId: this.userComment.userId,
                  targetType: this.userComment.targetType,
                  targetId: this.userComment.targetId,
                  replyToId: this.userComment.replyToId,
                  content: this.userComment.content,
                  createdAt: this.userComment.createdAt,
                })

              await this.appUserCountService.updateCommentCount(tx, userId, 1)

              const commentCreatedEvent = this.buildCommentCreatedEventEnvelope(
                {
                  commentId: newComment.id,
                  userId: newComment.userId,
                  targetType: newComment.targetType as CommentTargetTypeEnum,
                  targetId: newComment.targetId,
                  replyToId: newComment.replyToId,
                  occurredAt: newComment.createdAt,
                  auditStatus: decision.auditStatus,
                  isHidden: decision.isHidden,
                },
              )

              if (this.isVisible({ ...decision, deletedAt: null })) {
                await this.applyCommentCountDelta(tx, targetType, targetId, 1)

                const meta = await resolver.resolveMeta(tx, targetId)
                if (resolver.postCommentHook) {
                  await resolver.postCommentHook(tx, newComment, meta)
                }

                await this.compensateVisibleCommentEffects(
                  tx,
                  newComment,
                  meta,
                  commentCreatedEvent,
                )
              }

              return {
                comment: newComment,
                visible: this.isVisible({ ...decision, deletedAt: null }),
                eventEnvelope: commentCreatedEvent,
              }
            }),
          {
            maxRetries: 3,
          },
        ),
      {
        conflict: '请求冲突，请稍后重试',
      },
    )
    if (
      canConsumeEventEnvelopeByConsumer(
        created.eventEnvelope,
        EventDefinitionConsumerEnum.GROWTH,
      )
    ) {
      await this.commentGrowthService.rewardCommentCreated(this.db, {
        userId: created.comment.userId,
        id: created.comment.id,
        targetType: created.comment.targetType,
        targetId: created.comment.targetId,
        occurredAt: created.comment.createdAt,
        eventEnvelope: created.eventEnvelope,
      })
    }

    return { id: created.comment.id }
  }

  /**
   * 回复评论
   *
   * 对已有评论进行回复。
   * 自动处理回复链（actualReplyToId 指向一级评论），
   * 进行敏感词审核，并处理可见回复的副作用。
   *
   * @param input - 回复评论参数，包含用户ID、评论内容、被回复评论ID
   * @returns 新创建的回复ID
   * @throws BadRequestException - 当被回复的评论不存在时抛出
   */
  async replyComment(input: ReplyCommentBodyDto & { userId: number }) {
    const { userId, content, replyToId } = input
    const bodyTokens = await this.emojiParserService.parse({
      body: content,
      scene: EmojiSceneEnum.COMMENT,
    })

    // 查询被回复的评论
    const replyTo = await this.db.query.userComment.findFirst({
      where: { id: replyToId },
      columns: {
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

    const created = await this.drizzle.withTransaction(async (tx) => {
      await resolver.ensureCanComment(tx, targetId)

      const [newComment] = await tx
        .insert(this.userComment)
        .values({
          targetType,
          targetId,
          userId,
          content,
          bodyTokens: bodyTokens.length ? bodyTokens : null,
          replyToId,
          actualReplyToId,
          ...decision,
        })
        .returning({
          id: this.userComment.id,
          userId: this.userComment.userId,
          targetType: this.userComment.targetType,
          targetId: this.userComment.targetId,
          replyToId: this.userComment.replyToId,
          content: this.userComment.content,
          createdAt: this.userComment.createdAt,
        })

      await this.appUserCountService.updateCommentCount(tx, userId, 1)

      const commentCreatedEvent = this.buildCommentCreatedEventEnvelope({
        commentId: newComment.id,
        userId: newComment.userId,
        targetType: newComment.targetType as CommentTargetTypeEnum,
        targetId: newComment.targetId,
        replyToId: newComment.replyToId,
        occurredAt: newComment.createdAt,
        auditStatus: decision.auditStatus,
        isHidden: decision.isHidden,
      })

      if (this.isVisible({ ...decision, deletedAt: null })) {
        await this.applyCommentCountDelta(
          tx,
          targetType as CommentTargetTypeEnum,
          targetId,
          1,
        )

        const meta = await resolver.resolveMeta(tx, targetId)
        const visibleCommentPayload = {
          ...newComment,
          replyTargetUserId: replyTo.userId,
        }
        if (resolver.postCommentHook) {
          await resolver.postCommentHook(tx, visibleCommentPayload, meta)
        }

        await this.compensateVisibleCommentEffects(
          tx,
          visibleCommentPayload,
          meta,
          commentCreatedEvent,
        )
      }

      return {
        comment: newComment,
        visible: this.isVisible({ ...decision, deletedAt: null }),
        eventEnvelope: commentCreatedEvent,
      }
    })

    if (
      canConsumeEventEnvelopeByConsumer(
        created.eventEnvelope,
        EventDefinitionConsumerEnum.GROWTH,
      )
    ) {
      await this.commentGrowthService.rewardCommentCreated(this.db, {
        userId: created.comment.userId,
        id: created.comment.id,
        targetType: created.comment.targetType,
        targetId: created.comment.targetId,
        occurredAt: created.comment.createdAt,
        eventEnvelope: created.eventEnvelope,
      })
    }

    return { id: created.comment.id }
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
    return this.drizzle.withTransaction(async (tx) => {
      const found = await tx.query.userComment.findFirst({
        where: userId
          ? {
              id: commentId,
              userId,
              deletedAt: { isNull: true },
            }
          : {
              id: commentId,
              deletedAt: { isNull: true },
            },
        columns: {
          id: true,
          userId: true,
          targetType: true,
          targetId: true,
          replyToId: true,
          createdAt: true,
          auditStatus: true,
          isHidden: true,
          likeCount: true,
        },
      })
      if (!found) {
        throw new BadRequestException('删除失败：数据不存在')
      }

      await tx
        .update(this.userComment)
        .set({
          deletedAt: new Date(),
        })
        .where(eq(this.userComment.id, found.id))

      await this.appUserCountService.updateCommentCount(tx, found.userId, -1)
      if (found.likeCount > 0) {
        await this.appUserCountService.updateCommentReceivedLikeCount(
          tx,
          found.userId,
          -found.likeCount,
        )
      }

      if (!this.isVisible({ ...found, deletedAt: null })) {
        return { id: found.id }
      }

      const resolver = this.getResolver(
        found.targetType as CommentTargetTypeEnum,
      )

      await this.applyCommentCountDelta(
        tx,
        found.targetType as CommentTargetTypeEnum,
        found.targetId,
        -1,
      )

      const meta = await resolver.resolveMeta(tx, found.targetId)
      if (resolver.postDeleteCommentHook) {
        await resolver.postDeleteCommentHook(
          tx,
          {
            id: found.id,
            userId: found.userId,
            targetType: found.targetType as CommentTargetTypeEnum,
            targetId: found.targetId,
            replyToId: found.replyToId,
            createdAt: found.createdAt,
          },
          meta,
        )
      }

      return { id: found.id }
    })
  }

  /**
   * 获取评论的回复列表
   *
   * 分页查询指定一级评论下的所有回复（扁平化展示）。
   * 只返回审核通过、未隐藏、未删除的回复。
   *
   * @param query - 查询参数，包含一级评论ID和分页信息
   * @returns 分页的回复列表，包含用户基本信息
   */
  async getReplies(query: QueryCommentRepliesDto & { userId?: number }) {
    const { commentId, pageIndex, pageSize, userId } = query
    const page = await this.drizzle.ext.findPagination(this.userComment, {
      where: and(
        eq(this.userComment.actualReplyToId, commentId),
        eq(this.userComment.auditStatus, AuditStatusEnum.APPROVED),
        eq(this.userComment.isHidden, false),
        isNull(this.userComment.deletedAt),
      ),
      pageIndex,
      pageSize,
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (page.list.length === 0) {
      return page
    }

    const userIds = [...new Set(page.list.map((item) => item.userId))]
    const commentIds = page.list.map((item) => item.id)
    const [users, likedMap] = await Promise.all([
      userIds.length
        ? this.db
            .select({
              id: this.appUser.id,
              nickname: this.appUser.nickname,
              avatarUrl: this.appUser.avatarUrl,
            })
            .from(this.appUser)
            .where(inArray(this.appUser.id, userIds))
        : Promise.resolve([]),
      this.getCommentLikedMap(commentIds, userId),
    ])
    const userMap = new Map(users.map((item) => [item.id, item] as const))

    return {
      ...page,
      list: page.list.map((item) => {
        const user = userMap.get(item.userId)
        return {
          ...item,
          liked: likedMap.get(item.id) ?? false,
          user: user ?? undefined,
        }
      }),
    }
  }

  /**
   * 获取目标对象的评论列表
   *
   * 分页查询指定目标（漫画/小说等）下的一级评论，
   * 并预加载每条评论的前 N 条回复预览。
   *
   * 只返回审核通过、未隐藏、未删除的评论。
   * 回复采用扁平化展示（actualReplyToId 指向一级评论）。
   *
   * @param query - 查询参数，包含目标类型、目标ID、分页信息、回复预览数量限制
   * @returns 分页的评论列表，每条评论包含用户信息、回复计数、回复预览
   */
  async getTargetComments(query: QueryTargetCommentsDto) {
    const {
      targetType,
      targetId,
      pageIndex,
      pageSize,
      previewReplyLimit = 3,
      userId,
    } = query
    const limit = Math.max(0, Math.min(previewReplyLimit, 10))
    const page = await this.drizzle.ext.findPagination(this.userComment, {
      where: and(
        eq(this.userComment.targetType, targetType),
        eq(this.userComment.targetId, targetId),
        isNull(this.userComment.replyToId),
        eq(this.userComment.auditStatus, AuditStatusEnum.APPROVED),
        eq(this.userComment.isHidden, false),
        isNull(this.userComment.deletedAt),
      ),
      pageIndex,
      pageSize,
      orderBy: {
        createdAt: 'desc',
      },
      pick: [
        'id',
        'userId',
        'targetType',
        'targetId',
        'content',
        'bodyTokens',
        'floor',
        'likeCount',
        'createdAt',
      ],
    })

    if (page.list.length === 0) {
      return page
    }

    const rootIds = page.list.map((item) => item.id)

    let previewReplies: {
      id: number
      userId: number
      actualReplyToId: number | null
      replyToId: number | null
      content: string
      bodyTokens: unknown
      likeCount: number
      createdAt: Date
      totalCount?: number
    }[] = []
    const replyCountMap = new Map<number, number>()

    if (limit > 0) {
      // 合并计数与预览查询：使用窗口函数同时获取前 N 条回复和总回复数
      const subquery = this.db
        .select({
          id: this.userComment.id,
          userId: this.userComment.userId,
          actualReplyToId: this.userComment.actualReplyToId,
          replyToId: this.userComment.replyToId,
          content: this.userComment.content,
          bodyTokens: this.userComment.bodyTokens,
          likeCount: this.userComment.likeCount,
          createdAt: this.userComment.createdAt,
          rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${this.userComment.actualReplyToId} ORDER BY ${this.userComment.createdAt} ASC)`.as(
            'rn',
          ),
          totalCount:
            sql<number>`COUNT(*) OVER (PARTITION BY ${this.userComment.actualReplyToId})`.as(
              'totalCount',
            ),
        })
        .from(this.userComment)
        .where(
          and(
            inArray(this.userComment.actualReplyToId, rootIds),
            eq(this.userComment.auditStatus, AuditStatusEnum.APPROVED),
            eq(this.userComment.isHidden, false),
            isNull(this.userComment.deletedAt),
          ),
        )
        .as('t')

      previewReplies = await this.db
        .select()
        .from(subquery)
        .where(lte(subquery.rn, limit))

      // 从预览结果中提取总计数
      for (const reply of previewReplies) {
        if (
          reply.actualReplyToId &&
          !replyCountMap.has(reply.actualReplyToId)
        ) {
          replyCountMap.set(reply.actualReplyToId, Number(reply.totalCount))
        }
      }
    } else {
      // 如果不需要预览，则只查询总计数
      const replyCountRows = await this.db
        .select({
          rootId: this.userComment.actualReplyToId,
          count: sql<number>`count(*)`,
        })
        .from(this.userComment)
        .where(
          and(
            inArray(this.userComment.actualReplyToId, rootIds),
            eq(this.userComment.auditStatus, AuditStatusEnum.APPROVED),
            eq(this.userComment.isHidden, false),
            isNull(this.userComment.deletedAt),
          ),
        )
        .groupBy(this.userComment.actualReplyToId)

      for (const row of replyCountRows) {
        if (row.rootId !== null) {
          replyCountMap.set(row.rootId, Number(row.count))
        }
      }
    }

    const previewRepliesByRoot = new Map<
      number,
      {
        id: number
        userId: number
        actualReplyToId: number
        replyToId: number | null
        content: string
        bodyTokens: unknown
        likeCount: number
        createdAt: Date
      }[]
    >()

    for (const reply of previewReplies) {
      if (!reply.actualReplyToId) {
        continue
      }
      const rootReplyList =
        previewRepliesByRoot.get(reply.actualReplyToId) ?? []
      rootReplyList.push({
        id: reply.id,
        userId: reply.userId,
        actualReplyToId: reply.actualReplyToId,
        replyToId: reply.replyToId,
        content: reply.content,
        bodyTokens: reply.bodyTokens,
        likeCount: reply.likeCount,
        createdAt: reply.createdAt,
      })
      previewRepliesByRoot.set(reply.actualReplyToId, rootReplyList)
    }

    const userIds = [
      ...new Set([
        ...page.list.map((item) => item.userId),
        ...previewReplies.map((item) => item.userId),
      ]),
    ]
    const commentIds = [
      ...new Set([...rootIds, ...previewReplies.map((item) => item.id)]),
    ]
    const [users, likedMap] = await Promise.all([
      userIds.length
        ? this.db
            .select({
              id: this.appUser.id,
              nickname: this.appUser.nickname,
              avatarUrl: this.appUser.avatarUrl,
            })
            .from(this.appUser)
            .where(inArray(this.appUser.id, userIds))
        : Promise.resolve([]),
      this.getCommentLikedMap(commentIds, userId),
    ])
    const userMap = new Map(users.map((item) => [item.id, item] as const))

    return {
      ...page,
      list: page.list.map((item) => {
        const replyCount = replyCountMap.get(item.id) ?? 0
        const previewReplies = (previewRepliesByRoot.get(item.id) ?? []).map(
          (reply) => ({
            id: reply.id,
            userId: reply.userId,
            content: reply.content,
            bodyTokens: reply.bodyTokens,
            replyToId: reply.replyToId,
            likeCount: reply.likeCount,
            createdAt: reply.createdAt,
            liked: likedMap.get(reply.id) ?? false,
            user: userMap.get(reply.userId) ?? undefined,
          }),
        )

        return {
          ...item,
          liked: likedMap.get(item.id) ?? false,
          user: userMap.get(item.userId) ?? undefined,
          replyCount,
          previewReplies,
          hasMoreReplies: replyCount > previewReplies.length,
        }
      }),
    }
  }

  /**
   * 获取用户的评论列表
   *
   * 分页查询指定用户的所有评论（包括回复）。
   * 包含已隐藏和待审核的评论（用户自己的评论需要能看到状态）。
   *
   * @param query - 查询参数，包含分页信息
   * @param userId - 用户ID
   * @returns 分页的评论列表
   */
  async getUserComments(query: QueryMyCommentPageDto, userId: number) {
    const conditions: SQL[] = [
      eq(this.userComment.userId, userId),
      isNull(this.userComment.deletedAt),
    ]

    if (query.targetType !== undefined) {
      conditions.push(eq(this.userComment.targetType, query.targetType))
    }
    if (query.targetId !== undefined) {
      conditions.push(eq(this.userComment.targetId, query.targetId))
    }
    if (query.auditStatus !== undefined) {
      conditions.push(eq(this.userComment.auditStatus, query.auditStatus))
    }

    return this.drizzle.ext.findPagination(this.userComment, {
      where: and(...conditions),
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  /**
   * 分页查询管理端评论列表。
   * 支持按评论自身、目标、回复链、审核状态、隐藏状态与关键词筛选。
   */
  async getAdminCommentPage(query: QueryAdminCommentPageDto) {
    const conditions: SQL[] = [isNull(this.userComment.deletedAt)]

    if (query.id !== undefined) {
      conditions.push(eq(this.userComment.id, query.id))
    }
    if (query.userId !== undefined) {
      conditions.push(eq(this.userComment.userId, query.userId))
    }
    if (query.targetType !== undefined) {
      conditions.push(eq(this.userComment.targetType, query.targetType))
    }
    if (query.targetId !== undefined) {
      conditions.push(eq(this.userComment.targetId, query.targetId))
    }
    if (query.replyToId !== undefined) {
      if (query.replyToId === null) {
        conditions.push(isNull(this.userComment.replyToId))
      } else {
        conditions.push(eq(this.userComment.replyToId, query.replyToId))
      }
    }
    if (query.actualReplyToId !== undefined) {
      if (query.actualReplyToId === null) {
        conditions.push(isNull(this.userComment.actualReplyToId))
      } else {
        conditions.push(
          eq(this.userComment.actualReplyToId, query.actualReplyToId),
        )
      }
    }
    if (query.auditStatus !== undefined) {
      conditions.push(eq(this.userComment.auditStatus, query.auditStatus))
    }
    if (query.isHidden !== undefined) {
      conditions.push(eq(this.userComment.isHidden, query.isHidden))
    }
    if (query.keyword?.trim()) {
      conditions.push(
        buildILikeCondition(this.userComment.content, query.keyword)!,
      )
    }

    const page = await this.drizzle.ext.findPagination(this.userComment, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    })

    if (page.list.length === 0) {
      return page
    }

    const userIds = [...new Set(page.list.map((item) => item.userId))]
    const users = userIds.length
      ? await this.db
          .select({
            id: this.appUser.id,
            nickname: this.appUser.nickname,
            avatarUrl: this.appUser.avatarUrl,
            isEnabled: this.appUser.isEnabled,
            status: this.appUser.status,
          })
          .from(this.appUser)
          .where(inArray(this.appUser.id, userIds))
      : []
    const userMap = new Map(users.map((item) => [item.id, item] as const))

    return {
      ...page,
      list: page.list.map((item) => ({
        ...item,
        user: userMap.get(item.userId) ?? undefined,
      })),
    }
  }

  /**
   * 获取管理端评论详情。
   * 额外补齐评论作者和被回复评论的基础信息，方便后台审核定位上下文。
   */
  async getAdminCommentDetail(commentId: number) {
    const comment = await this.db.query.userComment.findFirst({
      where: {
        id: commentId,
        deletedAt: { isNull: true },
      },
      with: {
        user: {
          columns: {
            id: true,
            nickname: true,
            avatarUrl: true,
            isEnabled: true,
            status: true,
          },
        },
        replyTo: {
          columns: {
            id: true,
            userId: true,
            content: true,
            replyToId: true,
            actualReplyToId: true,
            auditStatus: true,
            isHidden: true,
            deletedAt: true,
            createdAt: true,
          },
          with: {
            user: {
              columns: {
                id: true,
                nickname: true,
                avatarUrl: true,
                isEnabled: true,
                status: true,
              },
            },
          },
        },
      },
    })

    if (!comment) {
      throw new NotFoundException('评论不存在')
    }

    return comment
  }

  /**
   * 更新评论审核状态。
   * 审核通过首次使评论可见时，补发评论奖励与回复通知；
   * 已进入终态的评论不允许回退为待审核。
   */
  async updateCommentAuditStatus(
    input: UpdateAdminCommentAuditStatusDto & { auditById: number, auditRole?: AuditRoleEnum },
  ) {
    const current = await this.db.query.userComment.findFirst({
      where: {
        id: input.id,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        userId: true,
        targetType: true,
        targetId: true,
        replyToId: true,
        content: true,
        createdAt: true,
        auditStatus: true,
        isHidden: true,
        deletedAt: true,
      },
    })

    if (!current) {
      throw new NotFoundException('评论不存在')
    }

    this.ensureCanUpdateCommentAuditStatus(
      current.auditStatus as AuditStatusEnum,
      input.auditStatus,
    )

    const handled = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const auditAt = new Date()
        const result = await tx
          .update(this.userComment)
          .set({
            auditStatus: input.auditStatus,
            auditReason: input.auditReason ?? null,
            auditById: input.auditById,
            auditRole: input.auditRole ?? AuditRoleEnum.ADMIN,
            auditAt,
          })
          .where(
            and(
              eq(this.userComment.id, input.id),
              isNull(this.userComment.deletedAt),
            ),
          )
        this.drizzle.assertAffectedRows(result, '评论不存在')

        return this.syncCommentVisibilityTransition(tx, {
          current: current as CommentModerationState,
          nextAuditStatus: input.auditStatus,
          nextIsHidden: current.isHidden,
        })
      }),
    )

    if (
      handled.eventEnvelope &&
      handled.rewardComment &&
      canConsumeEventEnvelopeByConsumer(
        handled.eventEnvelope,
        EventDefinitionConsumerEnum.GROWTH,
      )
    ) {
      await this.commentGrowthService.rewardCommentCreated(this.db, {
        userId: handled.rewardComment.userId,
        id: handled.rewardComment.id,
        targetType: handled.rewardComment.targetType,
        targetId: handled.rewardComment.targetId,
        occurredAt: handled.rewardComment.createdAt,
        eventEnvelope: handled.eventEnvelope,
      })
    }

    return true
  }

  /**
   * 更新评论隐藏状态。
   * 仅在可见性真正发生变化时同步评论计数与目标派生字段。
   */
  async updateCommentHidden(input: UpdateAdminCommentHiddenDto) {
    const current = await this.db.query.userComment.findFirst({
      where: {
        id: input.id,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        userId: true,
        targetType: true,
        targetId: true,
        replyToId: true,
        content: true,
        createdAt: true,
        auditStatus: true,
        isHidden: true,
        deletedAt: true,
      },
    })

    if (!current) {
      throw new NotFoundException('评论不存在')
    }

    const handled = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const result = await tx
          .update(this.userComment)
          .set({
            isHidden: input.isHidden,
          })
          .where(
            and(
              eq(this.userComment.id, input.id),
              isNull(this.userComment.deletedAt),
            ),
          )
        this.drizzle.assertAffectedRows(result, '评论不存在')

        return this.syncCommentVisibilityTransition(tx, {
          current: current as CommentModerationState,
          nextAuditStatus: current.auditStatus as AuditStatusEnum,
          nextIsHidden: input.isHidden,
        })
      }),
    )

    if (
      handled.eventEnvelope &&
      handled.rewardComment &&
      canConsumeEventEnvelopeByConsumer(
        handled.eventEnvelope,
        EventDefinitionConsumerEnum.GROWTH,
      )
    ) {
      await this.commentGrowthService.rewardCommentCreated(this.db, {
        userId: handled.rewardComment.userId,
        id: handled.rewardComment.id,
        targetType: handled.rewardComment.targetType,
        targetId: handled.rewardComment.targetId,
        occurredAt: handled.rewardComment.createdAt,
        eventEnvelope: handled.eventEnvelope,
      })
    }

    return true
  }
}
