import type { Db, PostgresErrorSourceObject } from '@db/core'
import type { JsonValue } from '@libs/platform/utils'
import type { SQL } from 'drizzle-orm'
import type {
  CommentModerationState,
  CommentVisibleState,
  CommentWriteContext,
  TransactionRetryOptions,
  VisibleCommentEffectPayload,
} from './comment.type'
import { buildILikeCondition, DrizzleService } from '@db/core'

import { EventDefinitionConsumerEnum } from '@libs/growth/event-definition/event-definition.constant'
import {
  canConsumeEventEnvelopeByConsumer,
  createDefinedEventEnvelope,
  EventEnvelopeGovernanceStatusEnum,
} from '@libs/growth/event-definition/event-envelope.type'
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import { MessageDomainEventFactoryService } from '@libs/message/eventing/message-domain-event.factory'
import { MessageDomainEventPublisher as MessageDomainEventPublisherService } from '@libs/message/eventing/message-domain-event.publisher'
import { AuditRoleEnum, AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { SensitiveWordLevelEnum } from '@libs/sensitive-word/sensitive-word-constant'
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import { SensitiveWordStatisticsService } from '@libs/sensitive-word/sensitive-word-statistics.service'
import { ConfigReader } from '@libs/system-config/config-reader'
import { AppUserCountService } from '@libs/user/app-user-count.service'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, desc, eq, inArray, isNull, lte, max, or, sql } from 'drizzle-orm'
import { EmojiCatalogService } from '../emoji/emoji-catalog.service'
import { buildRecentEmojiUsageItems } from '../emoji/emoji-recent-usage.helper'
import { EmojiSceneEnum } from '../emoji/emoji.constant'
import { LikeTargetTypeEnum } from '../like/like.constant'
import { LikeService } from '../like/like.service'
import { MentionSourceTypeEnum } from '../mention/mention.constant'
import { MentionService } from '../mention/mention.service'
import { CommentGrowthService } from './comment-growth.service'
import { CommentPermissionService } from './comment-permission.service'
import { CommentSortTypeEnum, CommentTargetTypeEnum } from './comment.constant'
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
    /** 消息域事件发布器，用于发送通知事件 */
    private readonly messageDomainEventPublisher: MessageDomainEventPublisherService,
    private readonly messageDomainEventFactoryService: MessageDomainEventFactoryService,
    private readonly appUserCountService: AppUserCountService,
    private readonly drizzle: DrizzleService,
    private readonly mentionService: MentionService,
    private readonly emojiCatalogService: EmojiCatalogService,
    private readonly sensitiveWordStatisticsService: SensitiveWordStatisticsService,
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
    let lastError = new Error('事务冲突重试次数已耗尽')

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        const drizzleError =
          error instanceof Error
            ? error
            : typeof error === 'object' && error !== null
              ? (error as PostgresErrorSourceObject)
              : undefined
        if (
          !this.drizzle.isSerializationFailure(drizzleError) ||
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
   * 批量加载评论作者精简信息。
   * 统一复用回复分页、目标评论分页和我的评论分页的用户装配逻辑。
   */
  private async getCommentUserMap(userIds: number[]) {
    const uniqueUserIds = [...new Set(userIds)]
    if (uniqueUserIds.length === 0) {
      return new Map<
        number,
        {
          id: number
          nickname: string | null
          avatarUrl: string | null
        }
      >()
    }

    const users = await this.db
      .select({
        id: this.appUser.id,
        nickname: this.appUser.nickname,
        avatarUrl: this.appUser.avatarUrl,
      })
      .from(this.appUser)
      .where(inArray(this.appUser.id, uniqueUserIds))

    return new Map(users.map((item) => [item.id, item] as const))
  }

  /**
   * 批量加载被回复目标简要信息。
   * 只返回未删除的父评论；已删除或缺失的父评论统一视为 undefined。
   */
  private async getReplyTargetMap(
    replyToIds: Array<number | null | undefined>,
  ) {
    const uniqueReplyToIds = [
      ...new Set(
        replyToIds.filter(
          (replyToId): replyToId is number => typeof replyToId === 'number',
        ),
      ),
    ]

    if (uniqueReplyToIds.length === 0) {
      return new Map<
        number,
        {
          id: number
          userId: number
          user?: {
            id: number
            nickname: string | null
            avatarUrl: string | null
          }
        }
      >()
    }

    const replyTargets = await this.db
      .select({
        id: this.userComment.id,
        userId: this.userComment.userId,
      })
      .from(this.userComment)
      .where(
        and(
          inArray(this.userComment.id, uniqueReplyToIds),
          isNull(this.userComment.deletedAt),
        ),
      )

    const userMap = await this.getCommentUserMap(
      replyTargets.map((item) => item.userId),
    )

    return new Map(
      replyTargets.map((item) => [
        item.id,
        {
          id: item.id,
          userId: item.userId,
          user: userMap.get(item.userId) ?? undefined,
        },
      ]),
    )
  }

  /**
   * 判断用户侧响应是否需要拼接 replyTo。
   * 直接回复主楼时不再回填 replyTo，只有回复某条楼中楼回复时才返回被回复目标。
   */
  private shouldAttachReplyTarget(
    replyToId?: number | null,
    actualReplyToId?: number | null,
  ) {
    return (
      typeof replyToId === 'number' &&
      typeof actualReplyToId === 'number' &&
      replyToId !== actualReplyToId
    )
  }

  /**
   * 返回用户侧真正需要拼接的 replyToId。
   * 直接回复主楼时统一返回 undefined，避免调用方重复写分支。
   */
  private getReplyTargetId(
    replyToId?: number | null,
    actualReplyToId?: number | null,
  ): number | undefined {
    return this.shouldAttachReplyTarget(replyToId, actualReplyToId)
      ? (replyToId ?? undefined)
      : undefined
  }

  /**
   * 从用户侧回复分页结果中移除内部使用的 actualReplyToId。
   */
  private omitActualReplyToId<T extends { actualReplyToId?: number | null }>(
    item: T,
  ) {
    const { actualReplyToId, ...rest } = item
    void actualReplyToId
    return rest
  }

  /**
   * 校验正文写入链路已显式传入 mentions。
   * 新规则要求评论正文必须显式携带 mentions，空数组表示无提及。
   */
  private ensureMentionsProvided(
    mentions:
      | CreateCommentBodyDto['mentions']
      | ReplyCommentBodyDto['mentions'],
  ) {
    if (!Array.isArray(mentions)) {
      throw new BadRequestException('mentions 为必填字段；无提及时请传空数组')
    }

    return mentions
  }

  private omitGeoSource<T>(item: T): Omit<T, 'geoSource'> {
    const nextItem = { ...item } as T & { geoSource?: string | null }
    delete nextItem.geoSource
    return nextItem
  }

  /**
   * 构建评论列表排序规则。
   * latest 按最新时间倒序；hot 对回复和我的评论优先按点赞数排序。
   */
  private buildCommentOrderBy(sort?: CommentSortTypeEnum) {
    if (sort === CommentSortTypeEnum.HOT) {
      return [
        { likeCount: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ] as Array<Record<string, 'asc' | 'desc'>>
    }

    return [{ createdAt: 'desc' }, { id: 'desc' }] as Array<
      Record<string, 'asc' | 'desc'>
    >
  }

  /**
   * 解析论坛主题作者用户 ID。
   * 非论坛主题场景固定返回 undefined，供作者标记与作者筛选复用。
   */
  private async getForumTopicAuthorUserId(
    targetType: CommentTargetTypeEnum,
    targetId: number,
  ) {
    if (targetType !== CommentTargetTypeEnum.FORUM_TOPIC) {
      return undefined
    }

    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id: targetId,
        deletedAt: { isNull: true },
      },
      columns: {
        userId: true,
      },
    })

    return topic?.userId
  }

  /**
   * 通过一级评论解析论坛主题作者。
   * 回复分页的作者标记依赖 commentId 先回溯到挂载目标。
   */
  private async getForumTopicAuthorUserIdByRootCommentId(commentId: number) {
    const rootComment = await this.db.query.userComment.findFirst({
      where: {
        id: commentId,
        deletedAt: { isNull: true },
      },
      columns: {
        targetType: true,
        targetId: true,
      },
    })

    if (!rootComment) {
      return undefined
    }

    return this.getForumTopicAuthorUserId(
      rootComment.targetType as CommentTargetTypeEnum,
      rootComment.targetId,
    )
  }

  /**
   * 构建一级评论查询条件。
   * 统一收口目标维度、可见性和“仅作者评论”过滤，避免 latest/hot 两条链路口径漂移。
   */
  private buildVisibleRootCommentConditions(params: {
    targetType: CommentTargetTypeEnum
    targetId: number
    authorUserId?: number
  }) {
    const conditions: SQL[] = [
      eq(this.userComment.targetType, params.targetType),
      eq(this.userComment.targetId, params.targetId),
      isNull(this.userComment.replyToId),
      eq(this.userComment.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.userComment.isHidden, false),
      isNull(this.userComment.deletedAt),
    ]

    if (params.authorUserId !== undefined) {
      conditions.push(eq(this.userComment.userId, params.authorUserId))
    }

    return conditions
  }

  /**
   * 构建可见回复查询条件。
   * 支持按根评论集合和“仅主题作者回复”两种维度裁剪。
   */
  private buildVisibleReplyConditions(params: {
    rootCommentId?: number
    rootCommentIds?: number[]
    authorUserId?: number
  }) {
    const conditions: SQL[] = [
      eq(this.userComment.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.userComment.isHidden, false),
      isNull(this.userComment.deletedAt),
    ]

    if (params.rootCommentId !== undefined) {
      conditions.push(
        eq(this.userComment.actualReplyToId, params.rootCommentId),
      )
    }
    if (params.rootCommentIds?.length) {
      conditions.push(
        inArray(this.userComment.actualReplyToId, params.rootCommentIds),
      )
    }
    if (params.authorUserId !== undefined) {
      conditions.push(eq(this.userComment.userId, params.authorUserId))
    }

    return conditions
  }

  /**
   * 加载一级评论下的回复预览与回复数。
   * 预览仍按创建时间正序返回，但 replyCount 会严格遵循“仅作者回复”过滤口径。
   */
  private async loadReplyPreviewBundle(params: {
    rootIds: number[]
    previewReplyLimit: number
    authorUserId?: number
  }) {
    const previewReplies: Array<{
      id: number
      userId: number
      actualReplyToId: number | null
      replyToId: number | null
      content: string
      bodyTokens: JsonValue
      likeCount: number
      geoCountry: string | null
      geoProvince: string | null
      geoCity: string | null
      geoIsp: string | null
      createdAt: Date
      totalCount?: number
    }> = []
    const replyCountMap = new Map<number, number>()
    const previewRepliesByRoot = new Map<
      number,
      Array<{
        id: number
        userId: number
        actualReplyToId: number
        replyToId: number | null
        content: string
        bodyTokens: JsonValue
        likeCount: number
        geoCountry?: string
        geoProvince?: string
        geoCity?: string
        geoIsp?: string
        createdAt: Date
      }>
    >()

    if (params.rootIds.length === 0) {
      return {
        previewReplies,
        replyCountMap,
        previewRepliesByRoot,
      }
    }

    const replyConditions = this.buildVisibleReplyConditions({
      rootCommentIds: params.rootIds,
      authorUserId: params.authorUserId,
    })

    let loadedPreviewReplies = previewReplies

    if (params.previewReplyLimit > 0) {
      const subquery = this.db
        .select({
          id: this.userComment.id,
          userId: this.userComment.userId,
          actualReplyToId: this.userComment.actualReplyToId,
          replyToId: this.userComment.replyToId,
          content: this.userComment.content,
          bodyTokens: this.userComment.bodyTokens,
          likeCount: this.userComment.likeCount,
          geoCountry: this.userComment.geoCountry,
          geoProvince: this.userComment.geoProvince,
          geoCity: this.userComment.geoCity,
          geoIsp: this.userComment.geoIsp,
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
        .where(and(...replyConditions))
        .as('t')

      loadedPreviewReplies = (await this.db
        .select()
        .from(subquery)
        .where(
          lte(subquery.rn, params.previewReplyLimit),
        )) as typeof previewReplies

      for (const reply of loadedPreviewReplies) {
        if (
          reply.actualReplyToId !== null &&
          !replyCountMap.has(reply.actualReplyToId)
        ) {
          replyCountMap.set(reply.actualReplyToId, Number(reply.totalCount))
        }
      }
    } else {
      const replyCountRows = await this.db
        .select({
          rootId: this.userComment.actualReplyToId,
          count: sql<number>`count(*)`,
        })
        .from(this.userComment)
        .where(and(...replyConditions))
        .groupBy(this.userComment.actualReplyToId)

      for (const row of replyCountRows) {
        if (row.rootId !== null) {
          replyCountMap.set(row.rootId, Number(row.count))
        }
      }
    }

    for (const reply of loadedPreviewReplies) {
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
        geoCountry: reply.geoCountry ?? undefined,
        geoProvince: reply.geoProvince ?? undefined,
        geoCity: reply.geoCity ?? undefined,
        geoIsp: reply.geoIsp ?? undefined,
        createdAt: reply.createdAt,
      })
      previewRepliesByRoot.set(reply.actualReplyToId, rootReplyList)
    }

    return {
      previewReplies: loadedPreviewReplies,
      replyCountMap,
      previewRepliesByRoot,
    }
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
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '已审核评论不能回退为待审核',
      )
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
    const result = this.sensitiveWordDetectService.getMatchedWordsWithMetadata({
      content,
    })
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
        policy.recordHits && result.publicHits.length
          ? result.publicHits
          : undefined,
      statisticsHits: result.hits,
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

    let replyTarget:
      | {
          id: number
          userId: number
          content: string
        }
        | undefined

    if (comment.replyToId) {
      replyTarget = await tx.query.userComment.findFirst({
        where: {
          id: comment.replyToId,
          deletedAt: { isNull: true },
        },
        columns: {
          id: true,
          userId: true,
          content: true,
        },
      })
    }

    const replyTargetUserId = comment.replyTargetUserId ?? replyTarget?.userId
    const excludedMentionReceiverUserIds =
      replyTargetUserId && replyTargetUserId !== comment.userId
        ? [replyTargetUserId]
        : []

    await this.mentionService.dispatchCommentMentionsInTx(tx, {
      commentId: comment.id,
      actorUserId: comment.userId,
      targetType: comment.targetType,
      targetId: comment.targetId,
      content: comment.content,
      targetDisplayTitle: meta.targetDisplayTitle,
      excludedReceiverUserIds: excludedMentionReceiverUserIds,
    })

    if (!comment.replyToId) {
      return
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
    await this.messageDomainEventPublisher.publishInTx(
      tx,
      this.messageDomainEventFactoryService.buildCommentRepliedEvent({
        receiverUserId: replyTargetUserId,
        actorUserId: comment.userId,
        commentId: comment.id,
        targetType: comment.targetType,
        targetId: comment.targetId,
        actorNickname: actor?.nickname,
        replyExcerpt: comment.content,
        parentCommentId: replyTarget?.id,
        parentCommentExcerpt: replyTarget?.content,
        targetDisplayTitle: meta.targetDisplayTitle,
      }),
    )

    // 如果目标所有者不是评论者，且不是回复评论（回复通知已发），可以发一个被评论通知
    // 但目前业务可能更细化，暂时保留回复通知逻辑。
    // 如果后续需要添加"作品被评论"通知，可以在这里或 resolver postCommentHook 处理。
  }

  /**
   * 计算删除评论时需要覆盖的评论范围。
   * - 删除回复：仅删除当前回复自身
   * - 删除一级评论：级联删除根评论及其整棵楼中楼回复树
   */
  private async getDeleteScopeComments(
    tx: Db,
    found: {
      id: number
      userId: number
      targetType: number
      targetId: number
      replyToId: number | null
      createdAt: Date
      auditStatus: number
      isHidden: boolean
      likeCount: number
      deletedAt: Date | null
    },
  ) {
    if (found.replyToId !== null) {
      return [found]
    }

    return tx
      .select({
        id: this.userComment.id,
        userId: this.userComment.userId,
        targetType: this.userComment.targetType,
        targetId: this.userComment.targetId,
        replyToId: this.userComment.replyToId,
        createdAt: this.userComment.createdAt,
        auditStatus: this.userComment.auditStatus,
        isHidden: this.userComment.isHidden,
        likeCount: this.userComment.likeCount,
        deletedAt: this.userComment.deletedAt,
      })
      .from(this.userComment)
      .where(
        and(
          isNull(this.userComment.deletedAt),
          or(
            eq(this.userComment.id, found.id),
            eq(this.userComment.actualReplyToId, found.id),
          ),
        ),
      )
  }

  /**
   * 回退被删除评论作者的评论数与评论获赞数。
   * 一级评论级联删除时按作者聚合后再写入，避免逐条更新放大事务开销。
   */
  private async rollbackDeletedCommentAuthorCounts(
    tx: Db,
    comments: Array<{
      userId: number
      likeCount: number
    }>,
  ) {
    const authorDeltas = new Map<
      number,
      { commentCount: number, receivedLikeCount: number }
    >()

    for (const comment of comments) {
      const current = authorDeltas.get(comment.userId) ?? {
        commentCount: 0,
        receivedLikeCount: 0,
      }
      current.commentCount += 1
      current.receivedLikeCount += comment.likeCount
      authorDeltas.set(comment.userId, current)
    }

    for (const [userId, delta] of authorDeltas) {
      await this.appUserCountService.updateCommentCount(
        tx,
        userId,
        -delta.commentCount,
      )
      if (delta.receivedLikeCount > 0) {
        await this.appUserCountService.updateCommentReceivedLikeCount(
          tx,
          userId,
          -delta.receivedLikeCount,
        )
      }
    }
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
  async createComment(
    input: CreateCommentBodyDto & { userId: number },
    context: CommentWriteContext = {},
  ) {
    const { userId, targetType, targetId, content } = input
    const mentions = this.ensureMentionsProvided(input.mentions)
    const bodyTokens = await this.mentionService.buildBodyTokens({
      content,
      mentions,
      scene: EmojiSceneEnum.COMMENT,
    })
    const recentUsageItems = buildRecentEmojiUsageItems(bodyTokens)

    // 校验用户是否有权限在该目标下评论
    await this.commentPermissionService.ensureCanComment(
      userId,
      targetType,
      targetId,
    )

    // 根据敏感词检测结果确定审核决策
    const decision = this.resolveAuditDecision(content)
    const { statisticsHits, ...persistedDecision } = decision
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
                  ...persistedDecision,
                  geoCountry: context.geoCountry,
                  geoProvince: context.geoProvince,
                  geoCity: context.geoCity,
                  geoIsp: context.geoIsp,
                  geoSource: context.geoSource,
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

              await this.sensitiveWordStatisticsService.recordEntityHitsInTx(
                tx,
                {
                  entityType: 'comment',
                  entityId: newComment.id,
                  operationType: 'create',
                  hits: statisticsHits,
                  occurredAt: newComment.createdAt,
                },
              )

              await this.mentionService.replaceMentionsInTx({
                tx,
                sourceType: MentionSourceTypeEnum.COMMENT,
                sourceId: newComment.id,
                content,
                mentions,
              })
              await this.emojiCatalogService.recordRecentUsageInTx(tx, {
                userId,
                scene: EmojiSceneEnum.COMMENT,
                items: recentUsageItems,
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
      await this.commentGrowthService.rewardCommentCreated({
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
  async replyComment(
    input: ReplyCommentBodyDto & { userId: number },
    context: CommentWriteContext = {},
  ) {
    const { userId, content, replyToId } = input
    const mentions = this.ensureMentionsProvided(input.mentions)
    const bodyTokens = await this.mentionService.buildBodyTokens({
      content,
      mentions,
      scene: EmojiSceneEnum.COMMENT,
    })
    const recentUsageItems = buildRecentEmojiUsageItems(bodyTokens)

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
        auditStatus: true,
        isHidden: true,
      },
    })

    // 校验被回复评论是否存在
    if (
      !replyTo ||
      replyTo.deletedAt ||
      replyTo.auditStatus !== AuditStatusEnum.APPROVED ||
      replyTo.isHidden
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '回复目标不存在',
      )
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
    const { statisticsHits, ...persistedDecision } = decision
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
          ...persistedDecision,
          geoCountry: context.geoCountry,
          geoProvince: context.geoProvince,
          geoCity: context.geoCity,
          geoIsp: context.geoIsp,
          geoSource: context.geoSource,
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

      await this.sensitiveWordStatisticsService.recordEntityHitsInTx(tx, {
        entityType: 'comment',
        entityId: newComment.id,
        operationType: 'create',
        hits: statisticsHits,
        occurredAt: newComment.createdAt,
      })

      await this.mentionService.replaceMentionsInTx({
        tx,
        sourceType: MentionSourceTypeEnum.COMMENT,
        sourceId: newComment.id,
        content,
        mentions,
      })
      await this.emojiCatalogService.recordRecentUsageInTx(tx, {
        userId,
        scene: EmojiSceneEnum.COMMENT,
        items: recentUsageItems,
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
      await this.commentGrowthService.rewardCommentCreated({
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
          deletedAt: true,
        },
      })
      if (!found) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '删除失败：数据不存在',
        )
      }

      const deleteScopeComments = await this.getDeleteScopeComments(tx, found)
      const deleteScopeIds = deleteScopeComments.map((item) => item.id)
      const deletedAt = new Date()

      await tx
        .update(this.userComment)
        .set({
          deletedAt,
        })
        .where(
          deleteScopeIds.length === 1
            ? eq(this.userComment.id, found.id)
            : inArray(this.userComment.id, deleteScopeIds),
        )

      await this.mentionService.deleteMentionsInTx({
        tx,
        sourceType: MentionSourceTypeEnum.COMMENT,
        sourceIds: deleteScopeIds,
      })

      await this.rollbackDeletedCommentAuthorCounts(tx, deleteScopeComments)

      const visibleDeletedCount = deleteScopeComments.filter((comment) =>
        this.isVisible(comment),
      ).length
      if (visibleDeletedCount === 0) {
        return true
      }

      const resolver = this.getResolver(
        found.targetType as CommentTargetTypeEnum,
      )

      await this.applyCommentCountDelta(
        tx,
        found.targetType as CommentTargetTypeEnum,
        found.targetId,
        -visibleDeletedCount,
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

      return true
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
    const { commentId, pageIndex, pageSize, userId, sort, onlyAuthor } = query
    const topicAuthorUserId =
      await this.getForumTopicAuthorUserIdByRootCommentId(commentId)
    const replyAuthorUserId =
      onlyAuthor && topicAuthorUserId !== undefined
        ? topicAuthorUserId
        : undefined
    const page = await this.drizzle.ext.findPagination(this.userComment, {
      where: and(
        ...this.buildVisibleReplyConditions({
          rootCommentId: commentId,
          authorUserId: replyAuthorUserId,
        }),
      ),
      pageIndex,
      pageSize,
      orderBy: this.buildCommentOrderBy(sort),
      pick: [
        'id',
        'targetType',
        'targetId',
        'userId',
        'content',
        'bodyTokens',
        'floor',
        'replyToId',
        'actualReplyToId',
        'likeCount',
        'geoCountry',
        'geoProvince',
        'geoCity',
        'geoIsp',
        'createdAt',
      ],
    })

    if (page.list.length === 0) {
      return page
    }

    const userIds = [...new Set(page.list.map((item) => item.userId))]
    const commentIds = page.list.map((item) => item.id)
    const [userMap, replyTargetMap, likedMap] = await Promise.all([
      this.getCommentUserMap(userIds),
      this.getReplyTargetMap(
        page.list
          .map((item) =>
            this.getReplyTargetId(item.replyToId, item.actualReplyToId),
          )
          .filter(
            (replyToId): replyToId is number => typeof replyToId === 'number',
          ),
      ),
      this.getCommentLikedMap(commentIds, userId),
    ])

    return {
      ...page,
      list: page.list.map((item) => {
        const replyTargetId = this.getReplyTargetId(
          item.replyToId,
          item.actualReplyToId,
        )
        const replyItem = this.omitActualReplyToId(this.omitGeoSource(item))
        const replyTo =
          replyTargetId === undefined
            ? undefined
            : (replyTargetMap.get(replyTargetId) ?? undefined)

        return {
          ...replyItem,
          liked: likedMap.get(item.id) ?? false,
          isAuthorComment:
            topicAuthorUserId !== undefined &&
            item.userId === topicAuthorUserId,
          user: userMap.get(item.userId) ?? undefined,
          ...(replyTo ? { replyTo } : {}),
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
      sort,
      onlyAuthor,
    } = query
    const limit = Math.max(0, Math.min(previewReplyLimit, 10))
    const topicAuthorUserId = await this.getForumTopicAuthorUserId(
      targetType,
      targetId,
    )
    const rootCommentAuthorUserId =
      onlyAuthor && topicAuthorUserId !== undefined
        ? topicAuthorUserId
        : undefined
    const rootConditions = this.buildVisibleRootCommentConditions({
      targetType,
      targetId,
      authorUserId: rootCommentAuthorUserId,
    })

    const page =
      sort === CommentSortTypeEnum.HOT
        ? await (async () => {
            const pageQuery = this.drizzle.buildPage({
              pageIndex,
              pageSize,
            })
            const replyAggregationConditions = [
              eq(this.userComment.targetType, targetType),
              eq(this.userComment.targetId, targetId),
              ...this.buildVisibleReplyConditions({
                authorUserId: rootCommentAuthorUserId,
              }),
            ]
            const replyCountSubquery = this.db
              .select({
                rootId: this.userComment.actualReplyToId,
                replyCount: sql<number>`count(*)::int`,
              })
              .from(this.userComment)
              .where(and(...replyAggregationConditions))
              .groupBy(this.userComment.actualReplyToId)
              .as('reply_count')
            const replyCountSql = sql<number>`coalesce(${replyCountSubquery.replyCount}, 0)::int`

            const [list, totalRows] = await Promise.all([
              this.db
                .select({
                  id: this.userComment.id,
                  userId: this.userComment.userId,
                  targetType: this.userComment.targetType,
                  targetId: this.userComment.targetId,
                  content: this.userComment.content,
                  bodyTokens: this.userComment.bodyTokens,
                  floor: this.userComment.floor,
                  likeCount: this.userComment.likeCount,
                  geoCountry: this.userComment.geoCountry,
                  geoProvince: this.userComment.geoProvince,
                  geoCity: this.userComment.geoCity,
                  geoIsp: this.userComment.geoIsp,
                  createdAt: this.userComment.createdAt,
                  replyCount: replyCountSql.as('replyCount'),
                })
                .from(this.userComment)
                .leftJoin(
                  replyCountSubquery,
                  eq(this.userComment.id, replyCountSubquery.rootId),
                )
                .where(and(...rootConditions))
                .orderBy(
                  desc(this.userComment.likeCount),
                  desc(replyCountSql),
                  desc(this.userComment.createdAt),
                  desc(this.userComment.id),
                )
                .limit(pageQuery.limit)
                .offset(pageQuery.offset),
              this.db
                .select({
                  count: sql<number>`count(*)::int`,
                })
                .from(this.userComment)
                .where(and(...rootConditions)),
            ])

            return {
              list,
              total: Number(totalRows[0]?.count ?? 0),
              pageIndex: pageQuery.pageIndex,
              pageSize: pageQuery.pageSize,
            }
          })()
        : await this.drizzle.ext.findPagination(this.userComment, {
            where: and(...rootConditions),
            pageIndex,
            pageSize,
            orderBy: this.buildCommentOrderBy(sort),
            pick: [
              'id',
              'userId',
              'targetType',
              'targetId',
              'content',
              'bodyTokens',
              'floor',
              'likeCount',
              'geoCountry',
              'geoProvince',
              'geoCity',
              'geoIsp',
              'createdAt',
            ],
          })

    if (page.list.length === 0) {
      return page
    }

    const rootIds = page.list.map((item) => item.id)
    const { previewReplies, previewRepliesByRoot, replyCountMap } =
      await this.loadReplyPreviewBundle({
        rootIds,
        previewReplyLimit: limit,
        authorUserId: rootCommentAuthorUserId,
      })

    const userIds = [
      ...new Set([
        ...page.list.map((item) => item.userId),
        ...previewReplies.map((item) => item.userId),
      ]),
    ]
    const commentIds = [
      ...new Set([...rootIds, ...previewReplies.map((item) => item.id)]),
    ]
    const [userMap, replyTargetMap, likedMap] = await Promise.all([
      this.getCommentUserMap(userIds),
      this.getReplyTargetMap(
        previewReplies
          .map((item) =>
            this.getReplyTargetId(item.replyToId, item.actualReplyToId),
          )
          .filter(
            (replyToId): replyToId is number => typeof replyToId === 'number',
          ),
      ),
      this.getCommentLikedMap(commentIds, userId),
    ])

    return {
      ...page,
      list: page.list.map((item) => {
        const replyCount = replyCountMap.get(item.id) ?? 0
        const previewReplies = (previewRepliesByRoot.get(item.id) ?? []).map(
          (reply) => {
            const replyTargetId = this.getReplyTargetId(
              reply.replyToId,
              reply.actualReplyToId,
            )
            const replyTo =
              replyTargetId === undefined
                ? undefined
                : (replyTargetMap.get(replyTargetId) ?? undefined)

            return {
              id: reply.id,
              userId: reply.userId,
              content: reply.content,
              bodyTokens: reply.bodyTokens,
              replyToId: reply.replyToId,
              likeCount: reply.likeCount,
              geoCountry: reply.geoCountry,
              geoProvince: reply.geoProvince,
              geoCity: reply.geoCity,
              geoIsp: reply.geoIsp,
              createdAt: reply.createdAt,
              liked: likedMap.get(reply.id) ?? false,
              isAuthorComment:
                topicAuthorUserId !== undefined &&
                reply.userId === topicAuthorUserId,
              user: userMap.get(reply.userId) ?? undefined,
              ...(replyTo ? { replyTo } : {}),
            }
          },
        )

        return {
          ...item,
          geoCountry: item.geoCountry ?? undefined,
          geoProvince: item.geoProvince ?? undefined,
          geoCity: item.geoCity ?? undefined,
          geoIsp: item.geoIsp ?? undefined,
          liked: likedMap.get(item.id) ?? false,
          isAuthorComment:
            topicAuthorUserId !== undefined &&
            item.userId === topicAuthorUserId,
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

    const page = await this.drizzle.ext.findPagination(this.userComment, {
      where: and(...conditions),
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: this.buildCommentOrderBy(query.sort),
    })

    const replyTargetMap = await this.getReplyTargetMap(
      page.list
        .map((item) =>
          this.getReplyTargetId(item.replyToId, item.actualReplyToId),
        )
        .filter(
          (replyToId): replyToId is number => typeof replyToId === 'number',
        ),
    )

    return {
      ...page,
      list: page.list.map((item) => {
        const replyTargetId = this.getReplyTargetId(
          item.replyToId,
          item.actualReplyToId,
        )
        const replyTo =
          replyTargetId === undefined
            ? undefined
            : (replyTargetMap.get(replyTargetId) ?? undefined)

        return {
          ...this.omitGeoSource(item),
          ...(replyTo ? { replyTo } : {}),
        }
      }),
    }
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
      list: page.list.map((item) => {
        return {
          ...this.omitGeoSource(item),
          user: userMap.get(item.userId) ?? undefined,
        }
      }),
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '评论不存在',
      )
    }

    return this.omitGeoSource(comment)
  }

  /**
   * 更新评论审核状态。
   * 审核通过首次使评论可见时，补发评论奖励与回复通知；
   * 已进入终态的评论不允许回退为待审核。
   */
  async updateCommentAuditStatus(
    input: UpdateAdminCommentAuditStatusDto & {
      auditById: number
      auditRole?: AuditRoleEnum
    },
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '评论不存在',
      )
    }

    if ((current.auditStatus as AuditStatusEnum) === input.auditStatus) {
      return true
    }

    this.ensureCanUpdateCommentAuditStatus(
      current.auditStatus as AuditStatusEnum,
      input.auditStatus,
    )

    const handled = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const auditAt = new Date()
        const [updated] = await tx
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
              eq(this.userComment.auditStatus, current.auditStatus),
              eq(this.userComment.isHidden, current.isHidden),
            ),
          )
          .returning({
            id: this.userComment.id,
          })

        if (!updated) {
          const latest = await tx.query.userComment.findFirst({
            where: {
              id: input.id,
              deletedAt: { isNull: true },
            },
            columns: {
              auditStatus: true,
              isHidden: true,
            },
          })
          if (!latest) {
            throw new BusinessException(
              BusinessErrorCode.RESOURCE_NOT_FOUND,
              '评论不存在',
            )
          }
          if ((latest.auditStatus as AuditStatusEnum) === input.auditStatus) {
            return {
              rewardComment: null,
              eventEnvelope: null,
            }
          }
          this.ensureCanUpdateCommentAuditStatus(
            latest.auditStatus as AuditStatusEnum,
            input.auditStatus,
          )
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '评论状态已变化，请刷新后重试',
          )
        }

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
      await this.commentGrowthService.rewardCommentCreated({
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '评论不存在',
      )
    }

    if (current.isHidden === input.isHidden) {
      return true
    }

    const handled = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(this.userComment)
          .set({
            isHidden: input.isHidden,
          })
          .where(
            and(
              eq(this.userComment.id, input.id),
              isNull(this.userComment.deletedAt),
              eq(this.userComment.auditStatus, current.auditStatus),
              eq(this.userComment.isHidden, current.isHidden),
            ),
          )
          .returning({
            id: this.userComment.id,
          })

        if (!updated) {
          const latest = await tx.query.userComment.findFirst({
            where: {
              id: input.id,
              deletedAt: { isNull: true },
            },
            columns: {
              auditStatus: true,
              isHidden: true,
            },
          })
          if (!latest) {
            throw new BusinessException(
              BusinessErrorCode.RESOURCE_NOT_FOUND,
              '评论不存在',
            )
          }
          if (latest.isHidden === input.isHidden) {
            return {
              rewardComment: null,
              eventEnvelope: null,
            }
          }
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '评论状态已变化，请刷新后重试',
          )
        }

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
      await this.commentGrowthService.rewardCommentCreated({
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
