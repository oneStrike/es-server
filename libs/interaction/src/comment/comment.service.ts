import type { Db } from '@db/core'
import type {
  CommentVisibleState,
  CreateCommentInput,
  RepliesQuery,
  ReplyCommentInput,
  TargetCommentsQuery,
  TransactionRetryOptions,
  UserCommentsQuery,
  VisibleCommentEffectPayload,
} from './comment.type'
import { DrizzleService } from '@db/core'
import {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'

import { AuditStatusEnum } from '@libs/platform/constant'
import {
  SensitiveWordDetectService,
  SensitiveWordLevelEnum,
} from '@libs/sensitive-word'
import { ConfigReader } from '@libs/system-config'
import { AppUserCountService } from '@libs/user'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, lte, max, sql } from 'drizzle-orm'
import { CommentGrowthService } from './comment-growth.service'
import { CommentPermissionService } from './comment-permission.service'
import { CommentTargetTypeEnum } from './comment.constant'
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
    /** 消息发件箱服务，用于发送通知消息 */
    private readonly messageOutboxService: MessageOutboxService,
    private readonly appUserCountService: AppUserCountService,
    private readonly drizzle: DrizzleService,
  ) { }

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
  private isVisible(comment: CommentVisibleState): boolean {
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
    const replyTarget = await tx.query.userComment.findFirst({
      where: {
        id: comment.replyToId,
        deletedAt: { isNull: true },
      },
      columns: {
        userId: true,
      },
    })

    // 被回复评论不存在或自己回复自己，无需通知
    if (!replyTarget || replyTarget.userId === comment.userId) {
      return
    }

    // 将回复通知加入消息队列
    await this.messageOutboxService.enqueueNotificationEventInTx(tx, {
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
    })

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
  async createComment(input: CreateCommentInput) {
    const { userId, targetType, targetId, content } = input

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
                  floor,
                  ...decision,
                })
                .returning({
                  id: this.userComment.id,
                  userId: this.userComment.userId,
                  targetType: this.userComment.targetType,
                  targetId: this.userComment.targetId,
                  replyToId: this.userComment.replyToId,
                  createdAt: this.userComment.createdAt,
                })

              await this.appUserCountService.updateCommentCount(tx, userId, 1)

              if (this.isVisible({ ...decision, deletedAt: null })) {
                await this.applyCommentCountDelta(tx, targetType, targetId, 1)

                const meta = await resolver.resolveMeta(tx, targetId)
                if (resolver.postCommentHook) {
                  await resolver.postCommentHook(tx, targetId, userId, meta)
                }

                await this.compensateVisibleCommentEffects(tx, newComment, meta)
              }

              return {
                comment: newComment,
                visible: this.isVisible({ ...decision, deletedAt: null }),
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

    if (created.visible) {
      await this.commentGrowthService.rewardCommentCreated(this.db, {
        userId: created.comment.userId,
        id: created.comment.id,
        targetType: created.comment.targetType,
        targetId: created.comment.targetId,
        occurredAt: created.comment.createdAt,
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
  async replyComment(input: ReplyCommentInput) {
    const { userId, content, replyToId } = input

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
          createdAt: this.userComment.createdAt,
        })

      await this.appUserCountService.updateCommentCount(tx, userId, 1)

      if (this.isVisible({ ...decision, deletedAt: null })) {
        await this.applyCommentCountDelta(
          tx,
          targetType as CommentTargetTypeEnum,
          targetId,
          1,
        )

        const meta = await resolver.resolveMeta(tx, targetId)
        if (resolver.postCommentHook) {
          await resolver.postCommentHook(tx, targetId, userId, meta)
        }

        await this.compensateVisibleCommentEffects(tx, newComment, meta)
      }

      return {
        comment: newComment,
        visible: this.isVisible({ ...decision, deletedAt: null }),
      }
    })

    if (created.visible) {
      await this.commentGrowthService.rewardCommentCreated(this.db, {
        userId: created.comment.userId,
        id: created.comment.id,
        targetType: created.comment.targetType,
        targetId: created.comment.targetId,
        occurredAt: created.comment.createdAt,
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
  async getReplies(query: RepliesQuery) {
    const { commentId, pageIndex, pageSize } = query
    const page = await this.drizzle.ext.findPagination(this.userComment, {
      where: this.drizzle.buildWhere(this.userComment, {
        and: {
          actualReplyToId: commentId,
          auditStatus: AuditStatusEnum.APPROVED,
          isHidden: false,
          deletedAt: {
            isNull: true,
          },
        },
      }),
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
    const users = userIds.length
      ? await this.db
        .select({
          id: this.appUser.id,
          nickname: this.appUser.nickname,
          avatarUrl: this.appUser.avatarUrl,
        })
        .from(this.appUser)
        .where(inArray(this.appUser.id, userIds))
      : []
    const userMap = new Map(users.map((item) => [item.id, item]))

    return {
      ...page,
      list: page.list.map((item) => {
        const user = userMap.get(item.userId)
        return {
          ...item,
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
  async getTargetComments(query: TargetCommentsQuery) {
    const {
      targetType,
      targetId,
      pageIndex,
      pageSize,
      previewReplyLimit = 3,
    } = query
    const limit = Math.max(0, Math.min(previewReplyLimit, 10))
    const page = await this.drizzle.ext.findPagination(this.userComment, {
      where: this.drizzle.buildWhere(this.userComment, {
        and: {
          targetType,
          targetId,
          replyToId: {
            isNull: true,
          },
          auditStatus: AuditStatusEnum.APPROVED,
          isHidden: false,
          deletedAt: {
            isNull: true,
          },
        },
      }),
      pageIndex,
      pageSize,
      orderBy: {
        createdAt: 'desc',
      },
      pick: ['id', 'userId', 'targetType', 'content', 'createdAt', 'targetId'],
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
    const users = userIds.length
      ? await this.db
        .select({
          id: this.appUser.id,
          nickname: this.appUser.nickname,
          avatarUrl: this.appUser.avatarUrl,
        })
        .from(this.appUser)
        .where(inArray(this.appUser.id, userIds))
      : []
    const userMap = new Map(users.map((item) => [item.id, item]))

    return {
      ...page,
      list: page.list.map((item) => {
        const replyCount = replyCountMap.get(item.id) ?? 0
        const previewReplies = (previewRepliesByRoot.get(item.id) ?? []).map(
          (reply) => ({
            id: reply.id,
            userId: reply.userId,
            content: reply.content,
            replyToId: reply.replyToId,
            createdAt: reply.createdAt,
            user: userMap.get(reply.userId) ?? undefined,
          }),
        )

        return {
          ...item,
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
  async getUserComments(query: UserCommentsQuery, userId: number) {
    return this.drizzle.ext.findPagination(this.userComment, {
      where: this.drizzle.buildWhere(this.userComment, {
        and: {
          userId,
          targetType: query.targetType,
          targetId: query.targetId,
          auditStatus: query.auditStatus,
          deletedAt: {
            isNull: true,
          },
        },
      }),
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: {
        createdAt: 'desc',
      },
    })
  }
}
