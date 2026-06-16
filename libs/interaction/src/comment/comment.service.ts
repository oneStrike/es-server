import type { Db, SQL } from '@db/core'
import type { EventEnvelope } from '@libs/growth/event-definition/event-envelope.type'
import type { DispatchDefinedGrowthEventPayload } from '@libs/growth/growth-reward/types/growth-event-dispatch.type'
import type { JsonValue } from '@libs/platform/utils'
import type {
  AuthorCommentDelta,
  CommentModerationState,
  CommentVisibleState,
  CommentWriteContext,
  MaterializedCommentBodyWriteResult,
  ReplyTargetSnapshot,
  TargetCommentsQueryInput,
  TransactionRetryOptions,
  VisibleCommentEffectPayload,
} from './comment.type'

import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'
import { ForumHashtagBodyService } from '@libs/forum/hashtag/forum-hashtag-body.service'
import { ForumHashtagReferenceService } from '@libs/forum/hashtag/forum-hashtag-reference.service'
import {
  ForumHashtagCreateSourceTypeEnum,
  ForumHashtagReferenceSourceTypeEnum,
} from '@libs/forum/hashtag/forum-hashtag.constant'
import { EventDefinitionConsumerEnum } from '@libs/growth/event-definition/event-definition.constant'
import {
  canConsumeEventEnvelopeByConsumer,
  createDefinedEventEnvelope,
  EventEnvelopeGovernanceStatusEnum,
} from '@libs/growth/event-definition/event-envelope.type'
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import { BodyCompilerService } from '@libs/interaction/body/body-compiler.service'
import { BodyHtmlCodecService } from '@libs/interaction/body/body-html-codec.service'
import {
  BODY_VERSION_V1,
  BodySceneEnum,
} from '@libs/interaction/body/body.constant'
import { MessageDomainEventFactoryService } from '@libs/message/eventing/message-domain-event.factory'
import { MessageDomainEventPublisher as MessageDomainEventPublisherService } from '@libs/message/eventing/message-domain-event.publisher'
import {
  AuditRoleEnum,
  AuditStatusEnum,
  BusinessErrorCode,
} from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { SensitiveWordReviewPolicyService } from '@libs/sensitive-word/sensitive-word-review-policy.service'
import { SensitiveWordStatisticsService } from '@libs/sensitive-word/sensitive-word-statistics.service'
import { AppUserCountService } from '@libs/user/app-user-count.service'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import { EmojiCatalogService } from '../emoji/emoji-catalog.service'
import { EmojiSceneEnum } from '../emoji/emoji.constant'
import { LikeTargetTypeEnum } from '../like/like.constant'
import { LikeService } from '../like/like.service'
import { MentionSourceTypeEnum } from '../mention/mention.constant'
import { MentionService } from '../mention/mention.service'
import { InteractionSummaryReadService } from '../summary/interaction-summary-read.service'
import { CommentGrowthService } from './comment-growth.service'
import { CommentPermissionService } from './comment-permission.service'
import { CommentSortTypeEnum, CommentTargetTypeEnum } from './comment.constant'
import {
  CreateCommentBodyDto,
  QueryAdminCommentPageDto,
  QueryCommentRepliesDto,
  QueryMyCommentPageDto,
  ReplyCommentBodyDto,
  UpdateCommentAuditStatusDto,
  UpdateCommentHiddenDto,
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
    /** 敏感词审核决策服务，用于内容审核 */
    private readonly sensitiveWordReviewPolicyService: SensitiveWordReviewPolicyService,
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
    private readonly bodyHtmlCodecService: BodyHtmlCodecService,
    private readonly bodyCompilerService: BodyCompilerService,
    private readonly mentionService: MentionService,
    private readonly emojiCatalogService: EmojiCatalogService,
    private readonly sensitiveWordStatisticsService: SensitiveWordStatisticsService,
    private readonly forumHashtagBodyService: ForumHashtagBodyService,
    private readonly forumHashtagReferenceService: ForumHashtagReferenceService,
    private readonly interactionSummaryReadService: InteractionSummaryReadService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get userComment() {
    return this.drizzle.schema.userComment
  }

  private get userCommentFloorCounter() {
    return this.drizzle.schema.userCommentFloorCounter
  }

  private get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  /** 目标类型到解析器的映射表 */
  private readonly resolvers = new Map<
    CommentTargetTypeEnum,
    ICommentTargetResolver
  >()

  private async allocateRootCommentFloorInTx(
    tx: Db,
    targetType: CommentTargetTypeEnum,
    targetId: number,
  ) {
    const [counter] = await tx
      .insert(this.userCommentFloorCounter)
      .values({
        targetType,
        targetId,
        nextFloor: 2,
      })
      .onConflictDoUpdate({
        target: [
          this.userCommentFloorCounter.targetType,
          this.userCommentFloorCounter.targetId,
        ],
        set: {
          nextFloor: sql`${this.userCommentFloorCounter.nextFloor} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({
        nextFloor: this.userCommentFloorCounter.nextFloor,
      })

    return Number(counter.nextFloor) - 1
  }

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
          user: userMap.get(item.userId) ?? null,
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

  // 在事务内将评论正文物化为带 hashtag 事实的 canonical body 编译结果。
  private async materializeCommentBodyInTx(
    tx: Db,
    html: string,
    actorUserId: number,
    targetType: CommentTargetTypeEnum,
  ): Promise<MaterializedCommentBodyWriteResult> {
    const normalizedHtml = html.trim()
    if (!normalizedHtml) {
      throw new BadRequestException('html 不能为空')
    }
    const validatedBody = this.bodyHtmlCodecService.parseHtmlOrThrow(
      normalizedHtml,
      BodySceneEnum.COMMENT,
    )

    if (targetType !== CommentTargetTypeEnum.FORUM_TOPIC) {
      const compiledBody = await this.bodyCompilerService.compile(
        validatedBody,
        BodySceneEnum.COMMENT,
      )
      const canonicalHtml = this.bodyHtmlCodecService.renderHtml(
        validatedBody,
        BodySceneEnum.COMMENT,
      )
      return {
        ...compiledBody,
        html: canonicalHtml,
        hashtagFacts: [],
      }
    }

    const materialized = await this.forumHashtagBodyService.materializeBodyInTx(
      {
        tx,
        body: validatedBody,
        actorUserId,
        createSourceType: ForumHashtagCreateSourceTypeEnum.COMMENT_BODY,
      },
    )
    const compiledBody = await this.bodyCompilerService.compile(
      materialized.body,
      BodySceneEnum.COMMENT,
    )
    const canonicalHtml = this.bodyHtmlCodecService.renderHtml(
      materialized.body,
      BodySceneEnum.COMMENT,
    )

    return {
      ...compiledBody,
      html: canonicalHtml,
      hashtagFacts: materialized.hashtagFacts,
    }
  }

  // 判断论坛主题当前是否对外可见。
  private async isForumTopicVisibleInTx(tx: Db, topicId: number) {
    const topic = await tx.query.forumTopic.findFirst({
      where: {
        id: topicId,
        deletedAt: { isNull: true },
      },
      columns: {
        auditStatus: true,
        isHidden: true,
        deletedAt: true,
      },
    })

    return (
      !!topic &&
      this.isVisible({
        auditStatus: topic.auditStatus,
        isHidden: topic.isHidden,
        deletedAt: topic.deletedAt,
      })
    )
  }

  private omitGeoSource<T>(item: T): Omit<T, 'geoSource'> {
    const nextItem = { ...item } as T & { geoSource?: string | null }
    delete nextItem.geoSource
    return nextItem
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
      html: string
      content: string
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
        html: string
        content: string
        likeCount: number
        geoCountry: string | null
        geoProvince: string | null
        geoCity: string | null
        geoIsp: string | null
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
          html: this.userComment.html,
          content: this.userComment.content,
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
        html: reply.html,
        content: reply.content,
        likeCount: reply.likeCount,
        geoCountry: reply.geoCountry ?? null,
        geoProvince: reply.geoProvince ?? null,
        geoCity: reply.geoCity ?? null,
        geoIsp: reply.geoIsp ?? null,
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
    const decision =
      this.sensitiveWordReviewPolicyService.resolveContentDecision(content)

    return {
      auditStatus: decision.auditStatus,
      isHidden: decision.isHidden,
      recordHits: decision.recordHits,
      sensitiveWordHits: decision.publicHits.length
        ? decision.publicHits
        : undefined,
      statisticsHits: decision.statisticsHits,
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

    let replyTarget: ReplyTargetSnapshot | undefined

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
    const authorDeltas = new Map<number, AuthorCommentDelta>()

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
    const { userId, targetType, targetId, html } = input

    // 校验用户是否有权限在该目标下评论
    await this.commentPermissionService.ensureCanComment(
      userId,
      targetType,
      targetId,
    )

    const resolver = this.getResolver(targetType)

    const created = await this.drizzle.withErrorHandling(
      async () =>
        this.withTransactionConflictRetry(
          async () =>
            this.db.transaction(async (tx) => {
              await resolver.ensureCanComment(tx, targetId)
              await this.commentPermissionService.ensureCommentRateLimitInTx(
                tx,
                userId,
                targetType,
              )
              const compiledBody = await this.materializeCommentBodyInTx(
                tx,
                html,
                userId,
                targetType,
              )
              const decision = this.resolveAuditDecision(compiledBody.plainText)
              const { recordHits, statisticsHits, ...persistedDecision } =
                decision

              const floor = await this.allocateRootCommentFloorInTx(
                tx,
                targetType,
                targetId,
              )

              const [newComment] = await tx
                .insert(this.userComment)
                .values({
                  targetType,
                  targetId,
                  userId,
                  html: compiledBody.html,
                  content: compiledBody.plainText,
                  body: compiledBody.body as unknown as JsonValue,
                  bodyVersion: BODY_VERSION_V1,
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
                  html: this.userComment.html,
                  content: this.userComment.content,
                  createdAt: this.userComment.createdAt,
                })

              if (recordHits && statisticsHits.length) {
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
              }

              await this.mentionService.replaceMentionsInTx({
                tx,
                sourceType: MentionSourceTypeEnum.COMMENT,
                sourceId: newComment.id,
                content: compiledBody.plainText,
                mentions: compiledBody.mentionFacts,
              })
              await this.emojiCatalogService.recordRecentUsageInTx(tx, {
                userId,
                scene: EmojiSceneEnum.COMMENT,
                items: compiledBody.emojiRecentUsageItems,
              })
              if (targetType === CommentTargetTypeEnum.FORUM_TOPIC) {
                const meta = await resolver.resolveMeta(tx, targetId)
                if (!meta.sectionId) {
                  throw new BusinessException(
                    BusinessErrorCode.RESOURCE_NOT_FOUND,
                    '帖子板块信息缺失',
                  )
                }
                await this.forumHashtagReferenceService.replaceReferencesInTx({
                  tx,
                  sourceType: ForumHashtagReferenceSourceTypeEnum.COMMENT,
                  sourceId: newComment.id,
                  topicId: targetId,
                  sectionId: meta.sectionId,
                  userId,
                  sourceAuditStatus: decision.auditStatus,
                  sourceIsHidden: decision.isHidden,
                  isSourceVisible:
                    this.isVisible({ ...decision, deletedAt: null }) &&
                    (await this.isForumTopicVisibleInTx(tx, targetId)),
                  hashtagFacts: compiledBody.hashtagFacts,
                })
              }

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
    const { userId, html, replyToId } = input

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

    const resolver = this.getResolver(targetType as CommentTargetTypeEnum)

    const created = await this.drizzle.withTransaction(async (tx) => {
      await resolver.ensureCanComment(tx, targetId)
      await this.commentPermissionService.ensureCommentRateLimitInTx(
        tx,
        userId,
        targetType as CommentTargetTypeEnum,
      )
      const compiledBody = await this.materializeCommentBodyInTx(
        tx,
        html,
        userId,
        targetType as CommentTargetTypeEnum,
      )
      const decision = this.resolveAuditDecision(compiledBody.plainText)
      const { recordHits, statisticsHits, ...persistedDecision } = decision

      const [newComment] = await tx
        .insert(this.userComment)
        .values({
          targetType,
          targetId,
          userId,
          html: compiledBody.html,
          content: compiledBody.plainText,
          body: compiledBody.body as unknown as JsonValue,
          bodyVersion: BODY_VERSION_V1,
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
          html: this.userComment.html,
          content: this.userComment.content,
          createdAt: this.userComment.createdAt,
        })

      if (recordHits && statisticsHits.length) {
        await this.sensitiveWordStatisticsService.recordEntityHitsInTx(tx, {
          entityType: 'comment',
          entityId: newComment.id,
          operationType: 'create',
          hits: statisticsHits,
          occurredAt: newComment.createdAt,
        })
      }

      await this.mentionService.replaceMentionsInTx({
        tx,
        sourceType: MentionSourceTypeEnum.COMMENT,
        sourceId: newComment.id,
        content: compiledBody.plainText,
        mentions: compiledBody.mentionFacts,
      })
      await this.emojiCatalogService.recordRecentUsageInTx(tx, {
        userId,
        scene: EmojiSceneEnum.COMMENT,
        items: compiledBody.emojiRecentUsageItems,
      })
      if (targetType === CommentTargetTypeEnum.FORUM_TOPIC) {
        const meta = await resolver.resolveMeta(tx, targetId)
        if (!meta.sectionId) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '帖子板块信息缺失',
          )
        }
        await this.forumHashtagReferenceService.replaceReferencesInTx({
          tx,
          sourceType: ForumHashtagReferenceSourceTypeEnum.COMMENT,
          sourceId: newComment.id,
          topicId: targetId,
          sectionId: meta.sectionId,
          userId,
          sourceAuditStatus: decision.auditStatus,
          sourceIsHidden: decision.isHidden,
          isSourceVisible:
            this.isVisible({ ...decision, deletedAt: null }) &&
            (await this.isForumTopicVisibleInTx(tx, targetId)),
          hashtagFacts: compiledBody.hashtagFacts,
        })
      }

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
      return this.deleteCommentInTx(tx, commentId, userId)
    })
  }

  async deleteCommentInTx(tx: Db, commentId: number, userId?: number) {
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
        content: true,
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
    await this.forumHashtagReferenceService.deleteReferencesInTx({
      tx,
      sourceType: ForumHashtagReferenceSourceTypeEnum.COMMENT,
      sourceIds: deleteScopeIds,
    })

    await this.rollbackDeletedCommentAuthorCounts(tx, deleteScopeComments)

    const visibleDeletedCount = deleteScopeComments.filter((comment) =>
      this.isVisible(comment),
    ).length
    if (visibleDeletedCount === 0) {
      return true
    }

    const resolver = this.getResolver(found.targetType as CommentTargetTypeEnum)

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
          content: found.content,
          createdAt: found.createdAt,
        },
        meta,
      )
    }

    return true
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
    const legacyReplySort = (query as unknown as Record<string, unknown>).sort
    if (legacyReplySort !== undefined && legacyReplySort !== null) {
      throw new BadRequestException('评论回复列表不支持 sort 参数')
    }

    const { commentId, userId, onlyAuthor } = query
    const topicAuthorUserId =
      await this.getForumTopicAuthorUserIdByRootCommentId(commentId)
    const replyAuthorUserId =
      onlyAuthor && topicAuthorUserId !== undefined
        ? topicAuthorUserId
        : undefined
    const pageParams = this.drizzle.buildPageParams(query, {
      table: this.userComment,
      fallbackOrderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    const conditions = [
      ...this.buildVisibleReplyConditions({
        rootCommentId: commentId,
        authorUserId: replyAuthorUserId,
      }),
    ]
    if (pageParams.dateRange?.gte) {
      conditions.push(gte(this.userComment.createdAt, pageParams.dateRange.gte))
    }
    if (pageParams.dateRange?.lt) {
      conditions.push(lt(this.userComment.createdAt, pageParams.dateRange.lt))
    }
    const where = and(...conditions)
    const [rows, total] = await Promise.all([
      this.db
        .select({
          id: this.userComment.id,
          targetType: this.userComment.targetType,
          targetId: this.userComment.targetId,
          userId: this.userComment.userId,
          html: this.userComment.html,
          floor: this.userComment.floor,
          replyToId: this.userComment.replyToId,
          actualReplyToId: this.userComment.actualReplyToId,
          likeCount: this.userComment.likeCount,
          geoCountry: this.userComment.geoCountry,
          geoProvince: this.userComment.geoProvince,
          geoCity: this.userComment.geoCity,
          geoIsp: this.userComment.geoIsp,
          createdAt: this.userComment.createdAt,
        })
        .from(this.userComment)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.userComment, where),
    ])
    const page = toPageResult(rows, total, pageParams.page)

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
            ? null
            : (replyTargetMap.get(replyTargetId) ?? null)

        return {
          ...replyItem,
          liked: likedMap.get(item.id) ?? false,
          isAuthorComment:
            topicAuthorUserId !== undefined &&
            item.userId === topicAuthorUserId,
          user: userMap.get(item.userId) ?? null,
          replyTo,
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
  async getTargetComments(query: TargetCommentsQueryInput) {
    const {
      targetType,
      targetId,
      previewReplyLimit = 3,
      userId,
      sort,
      orderBy: clientOrderBy,
      onlyAuthor,
    } = query
    if (clientOrderBy?.trim() && sort !== undefined) {
      throw new BadRequestException('评论列表不支持同时使用 sort 和 orderBy')
    }

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
    const pageParams = this.drizzle.buildPageParams(query, {
      allowlistedOrderBy: {
        columns: {
          floor: this.userComment.floor,
          likeCount: this.userComment.likeCount,
          createdAt: this.userComment.createdAt,
          id: this.userComment.id,
        },
      },
    })
    if (pageParams.dateRange?.gte) {
      rootConditions.push(
        gte(this.userComment.createdAt, pageParams.dateRange.gte),
      )
    }
    if (pageParams.dateRange?.lt) {
      rootConditions.push(
        lt(this.userComment.createdAt, pageParams.dateRange.lt),
      )
    }
    const orderBy = clientOrderBy?.trim()
      ? pageParams.order.orderBySql
      : sort === CommentSortTypeEnum.HOT
        ? [
            desc(this.userComment.likeCount),
            desc(this.userComment.createdAt),
            desc(this.userComment.id),
          ]
        : sort === CommentSortTypeEnum.LATEST
          ? [desc(this.userComment.createdAt), desc(this.userComment.id)]
          : [asc(this.userComment.floor), asc(this.userComment.id)]
    const where = and(...rootConditions)
    const [rows, total] = await Promise.all([
      this.db
        .select({
          id: this.userComment.id,
          userId: this.userComment.userId,
          targetType: this.userComment.targetType,
          targetId: this.userComment.targetId,
          html: this.userComment.html,
          floor: this.userComment.floor,
          likeCount: this.userComment.likeCount,
          geoCountry: this.userComment.geoCountry,
          geoProvince: this.userComment.geoProvince,
          geoCity: this.userComment.geoCity,
          geoIsp: this.userComment.geoIsp,
          createdAt: this.userComment.createdAt,
        })
        .from(this.userComment)
        .where(where)
        .orderBy(...orderBy)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.userComment, where),
    ])
    const page = toPageResult(rows, total, pageParams.page)

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
                ? null
                : (replyTargetMap.get(replyTargetId) ?? null)

            return {
              id: reply.id,
              userId: reply.userId,
              html: reply.html,
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
              user: userMap.get(reply.userId) ?? null,
              replyTo: replyTo ?? null,
            }
          },
        )

        return {
          ...item,
          geoCountry: item.geoCountry ?? null,
          geoProvince: item.geoProvince ?? null,
          geoCity: item.geoCity ?? null,
          geoIsp: item.geoIsp ?? null,
          liked: likedMap.get(item.id) ?? false,
          isAuthorComment:
            topicAuthorUserId !== undefined &&
            item.userId === topicAuthorUserId,
          user: userMap.get(item.userId) ?? null,
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
    const legacyMyCommentSort = (query as unknown as Record<string, unknown>)
      .sort
    if (legacyMyCommentSort !== undefined && legacyMyCommentSort !== null) {
      throw new BadRequestException('我的评论列表不支持 sort 参数')
    }

    const conditions: SQL[] = [
      eq(this.userComment.userId, userId),
      isNull(this.userComment.deletedAt),
    ]
    const pageParams = this.drizzle.buildPageParams(query, {
      table: this.userComment,
      fallbackOrderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })

    if (query.targetType !== undefined) {
      conditions.push(eq(this.userComment.targetType, query.targetType))
    }
    if (query.targetId !== undefined) {
      conditions.push(eq(this.userComment.targetId, query.targetId))
    }
    if (query.auditStatus !== undefined) {
      conditions.push(eq(this.userComment.auditStatus, query.auditStatus))
    }
    if (pageParams.dateRange?.gte) {
      conditions.push(gte(this.userComment.createdAt, pageParams.dateRange.gte))
    }
    if (pageParams.dateRange?.lt) {
      conditions.push(lt(this.userComment.createdAt, pageParams.dateRange.lt))
    }

    const where = and(...conditions)
    const [rows, total] = await Promise.all([
      this.db
        .select({
          id: this.userComment.id,
          targetType: this.userComment.targetType,
          targetId: this.userComment.targetId,
          userId: this.userComment.userId,
          html: this.userComment.html,
          floor: this.userComment.floor,
          replyToId: this.userComment.replyToId,
          actualReplyToId: this.userComment.actualReplyToId,
          isHidden: this.userComment.isHidden,
          auditStatus: this.userComment.auditStatus,
          auditById: this.userComment.auditById,
          auditRole: this.userComment.auditRole,
          auditReason: this.userComment.auditReason,
          auditAt: this.userComment.auditAt,
          likeCount: this.userComment.likeCount,
          sensitiveWordHits: this.userComment.sensitiveWordHits,
          geoCountry: this.userComment.geoCountry,
          geoProvince: this.userComment.geoProvince,
          geoCity: this.userComment.geoCity,
          geoIsp: this.userComment.geoIsp,
          deletedAt: this.userComment.deletedAt,
          createdAt: this.userComment.createdAt,
          updatedAt: this.userComment.updatedAt,
        })
        .from(this.userComment)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.userComment, where),
    ])
    const page = toPageResult(rows, total, pageParams.page)

    const [replyTargetMap, targetSummaryMap] = await Promise.all([
      this.getReplyTargetMap(
        page.list
          .map((item) =>
            this.getReplyTargetId(item.replyToId, item.actualReplyToId),
          )
          .filter(
            (replyToId): replyToId is number => typeof replyToId === 'number',
          ),
      ),
      this.interactionSummaryReadService.getCommentTargetSummaryMap(page.list),
    ])

    return {
      ...page,
      list: page.list.map((item) => {
        const replyTargetId = this.getReplyTargetId(
          item.replyToId,
          item.actualReplyToId,
        )
        const replyTo =
          replyTargetId === undefined
            ? null
            : (replyTargetMap.get(replyTargetId) ?? null)

        return {
          ...this.omitGeoSource(item),
          targetSummary:
            targetSummaryMap.get(
              this.interactionSummaryReadService.buildTargetSummaryKey(item),
            ) ?? null,
          replyTo,
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
    const createdRange = buildDateOnlyRangeInAppTimeZone(
      query.startDate,
      query.endDate,
    )

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
    if (createdRange?.gte) {
      conditions.push(gte(this.userComment.createdAt, createdRange.gte))
    }
    if (createdRange?.lt) {
      conditions.push(lt(this.userComment.createdAt, createdRange.lt))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const pageQuery = this.drizzle.buildPage(query)
    const orderQuery = this.drizzle.buildOrderBy(
      [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
      { table: this.userComment },
    )
    const [list, total] = await Promise.all([
      this.db
        .select({
          id: this.userComment.id,
          targetType: this.userComment.targetType,
          targetId: this.userComment.targetId,
          userId: this.userComment.userId,
          html: this.userComment.html,
          floor: this.userComment.floor,
          replyToId: this.userComment.replyToId,
          actualReplyToId: this.userComment.actualReplyToId,
          isHidden: this.userComment.isHidden,
          auditStatus: this.userComment.auditStatus,
          auditById: this.userComment.auditById,
          auditRole: this.userComment.auditRole,
          auditReason: this.userComment.auditReason,
          auditAt: this.userComment.auditAt,
          likeCount: this.userComment.likeCount,
          sensitiveWordHits: this.userComment.sensitiveWordHits,
          createdAt: this.userComment.createdAt,
          updatedAt: this.userComment.updatedAt,
        })
        .from(this.userComment)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.userComment, where),
    ])
    const page = toPageResult(list, total, pageQuery)

    if (page.list.length === 0) {
      return page
    }

    const userIds = [...new Set(page.list.map((item) => item.userId))]
    const [users, targetSummaryMap, replyToSummaryMap] = await Promise.all([
      userIds.length
        ? this.db
            .select({
              id: this.appUser.id,
              nickname: this.appUser.nickname,
              avatarUrl: this.appUser.avatarUrl,
              isEnabled: this.appUser.isEnabled,
              status: this.appUser.status,
            })
            .from(this.appUser)
            .where(inArray(this.appUser.id, userIds))
        : [],
      this.interactionSummaryReadService.getCommentTargetSummaryMap(page.list),
      this.interactionSummaryReadService.getReplyCommentSummaryMap(
        page.list.map((item) => item.replyToId),
      ),
    ])
    const userMap = new Map(users.map((item) => [item.id, item] as const))

    return {
      ...page,
      list: page.list.map((item) => {
        return {
          ...this.omitGeoSource(item),
          user: userMap.get(item.userId) ?? null,
          targetSummary:
            targetSummaryMap.get(
              this.interactionSummaryReadService.buildTargetSummaryKey(item),
            ) ?? null,
          replyToSummary: item.replyToId
            ? (replyToSummaryMap.get(item.replyToId) ?? null)
            : null,
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
      columns: {
        id: true,
        targetType: true,
        targetId: true,
        userId: true,
        html: true,
        floor: true,
        replyToId: true,
        actualReplyToId: true,
        isHidden: true,
        auditStatus: true,
        auditById: true,
        auditRole: true,
        auditReason: true,
        auditAt: true,
        likeCount: true,
        sensitiveWordHits: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
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
            html: true,
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

    const [targetSummaryMap, auditorSummaryMap] = await Promise.all([
      this.interactionSummaryReadService.getCommentTargetSummaryMap([comment], {
        detail: true,
      }),
      this.interactionSummaryReadService.getAuditorSummaryMap([
        {
          auditById: comment.auditById,
          auditRole: comment.auditRole as AuditRoleEnum | null,
        },
      ]),
    ])
    const auditorSummaryKey =
      this.interactionSummaryReadService.buildAuditorSummaryKey({
        auditById: comment.auditById,
        auditRole: comment.auditRole as AuditRoleEnum | null,
      })
    const replyTo = comment.replyTo
      ? {
          ...comment.replyTo,
          user: comment.replyTo.user ?? null,
        }
      : null

    return {
      ...this.omitGeoSource(comment),
      user: comment.user ?? null,
      replyTo,
      targetSummary:
        targetSummaryMap.get(
          this.interactionSummaryReadService.buildTargetSummaryKey(comment),
        ) ?? null,
      auditorSummary: auditorSummaryKey
        ? (auditorSummaryMap.get(auditorSummaryKey) ?? null)
        : null,
    }
  }

  /**
   * 更新评论审核状态。
   * 审核通过首次使评论可见时，补发评论奖励与回复通知；
   * 已进入终态的评论不允许回退为待审核。
   */
  async updateCommentAuditStatus(
    input: UpdateCommentAuditStatusDto & {
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
      this.db.transaction(async (tx) =>
        this.updateCommentAuditStatusInTx(
          tx,
          input,
          current as CommentModerationState,
        ),
      ),
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

  async updateCommentAuditStatusInTx(
    tx: Db,
    input: UpdateCommentAuditStatusDto & {
      auditById: number
      auditRole?: AuditRoleEnum
    },
    current?: CommentModerationState,
  ) {
    const comment =
      current ??
      (await tx.query.userComment.findFirst({
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
          auditReason: true,
          isHidden: true,
          deletedAt: true,
        },
      }))

    if (!comment) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '评论不存在',
      )
    }

    if (
      (comment.auditStatus as AuditStatusEnum) === input.auditStatus &&
      (comment.auditReason ?? null) === (input.auditReason ?? null)
    ) {
      return {
        changed: false,
        rewardComment: null,
        eventEnvelope: null,
      }
    }

    this.ensureCanUpdateCommentAuditStatus(
      comment.auditStatus as AuditStatusEnum,
      input.auditStatus,
    )

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
          eq(this.userComment.auditStatus, comment.auditStatus),
          eq(this.userComment.isHidden, comment.isHidden),
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
          auditReason: true,
          isHidden: true,
        },
      })
      if (!latest) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '评论不存在',
        )
      }
      if (
        (latest.auditStatus as AuditStatusEnum) === input.auditStatus &&
        (latest.auditReason ?? null) === (input.auditReason ?? null)
      ) {
        return {
          changed: false,
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

    if (comment.targetType === CommentTargetTypeEnum.FORUM_TOPIC) {
      const topicVisible = await this.isForumTopicVisibleInTx(
        tx,
        comment.targetId,
      )
      await this.forumHashtagReferenceService.syncSourceVisibilityInTx({
        tx,
        sourceType: ForumHashtagReferenceSourceTypeEnum.COMMENT,
        sourceId: comment.id,
        sourceAuditStatus: input.auditStatus,
        sourceIsHidden: comment.isHidden,
        isSourceVisible:
          topicVisible &&
          this.isVisible({
            auditStatus: input.auditStatus,
            isHidden: comment.isHidden,
            deletedAt: null,
          }),
      })
    }

    const handled = await this.syncCommentVisibilityTransition(tx, {
      current: comment as CommentModerationState,
      nextAuditStatus: input.auditStatus,
      nextIsHidden: comment.isHidden,
    })

    return {
      ...handled,
      changed: true,
    }
  }

  /**
   * 更新评论隐藏状态。
   * 仅在可见性真正发生变化时同步评论计数与目标派生字段。
   */
  async updateCommentHidden(input: UpdateCommentHiddenDto) {
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
      this.db.transaction(async (tx) =>
        this.updateCommentHiddenInTx(
          tx,
          input,
          current as CommentModerationState,
        ),
      ),
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

  async updateCommentHiddenInTx(
    tx: Db,
    input: UpdateCommentHiddenDto,
    current?: CommentModerationState,
  ) {
    const comment =
      current ??
      (await tx.query.userComment.findFirst({
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
      }))

    if (!comment) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '评论不存在',
      )
    }

    if (comment.isHidden === input.isHidden) {
      return {
        changed: false,
        rewardComment: null,
        eventEnvelope: null,
      }
    }

    const [updated] = await tx
      .update(this.userComment)
      .set({
        isHidden: input.isHidden,
      })
      .where(
        and(
          eq(this.userComment.id, input.id),
          isNull(this.userComment.deletedAt),
          eq(this.userComment.auditStatus, comment.auditStatus),
          eq(this.userComment.isHidden, comment.isHidden),
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
          changed: false,
          rewardComment: null,
          eventEnvelope: null,
        }
      }
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '评论状态已变化，请刷新后重试',
      )
    }

    if (comment.targetType === CommentTargetTypeEnum.FORUM_TOPIC) {
      const topicVisible = await this.isForumTopicVisibleInTx(
        tx,
        comment.targetId,
      )
      await this.forumHashtagReferenceService.syncSourceVisibilityInTx({
        tx,
        sourceType: ForumHashtagReferenceSourceTypeEnum.COMMENT,
        sourceId: comment.id,
        sourceAuditStatus: comment.auditStatus as AuditStatusEnum,
        sourceIsHidden: input.isHidden,
        isSourceVisible:
          topicVisible &&
          this.isVisible({
            auditStatus: comment.auditStatus as AuditStatusEnum,
            isHidden: input.isHidden,
            deletedAt: null,
          }),
      })
    }

    const handled = await this.syncCommentVisibilityTransition(tx, {
      current: comment as CommentModerationState,
      nextAuditStatus: comment.auditStatus as AuditStatusEnum,
      nextIsHidden: input.isHidden,
    })

    return {
      ...handled,
      changed: true,
    }
  }

  async rewardCommentModerationIfNeeded(params: {
    eventEnvelope: EventEnvelope<GrowthRuleTypeEnum> | null
    rewardComment: VisibleCommentEffectPayload | null
  }) {
    const payload = this.buildCommentCreatedGrowthEventPayload(params)
    if (payload && params.rewardComment) {
      await this.commentGrowthService.rewardCommentCreated({
        userId: params.rewardComment.userId,
        id: params.rewardComment.id,
        targetType: params.rewardComment.targetType,
        targetId: params.rewardComment.targetId,
        occurredAt: params.rewardComment.createdAt,
        eventEnvelope: payload.eventEnvelope,
      })
    }
  }

  buildCommentCreatedGrowthEventPayload(params: {
    eventEnvelope?: EventEnvelope<GrowthRuleTypeEnum> | null
    rewardComment: VisibleCommentEffectPayload | null
  }): DispatchDefinedGrowthEventPayload | null {
    const { eventEnvelope, rewardComment } = params

    if (
      !eventEnvelope ||
      !rewardComment ||
      !canConsumeEventEnvelopeByConsumer(
        eventEnvelope,
        EventDefinitionConsumerEnum.GROWTH,
      )
    ) {
      return null
    }

    return {
      eventEnvelope,
      bizKey: `comment:create:${rewardComment.id}:user:${rewardComment.userId}`,
      source: 'comment',
      targetType: rewardComment.targetType,
      targetId: rewardComment.targetId,
    }
  }

  buildVisibleCommentGrowthEventPayload(comment: CommentModerationState) {
    return this.buildCommentCreatedGrowthEventPayload({
      rewardComment: this.toVisibleCommentEffectPayload(comment),
      eventEnvelope: this.buildCommentCreatedEventEnvelope({
        commentId: comment.id,
        userId: comment.userId,
        targetType: comment.targetType as CommentTargetTypeEnum,
        targetId: comment.targetId,
        replyToId: comment.replyToId,
        occurredAt: comment.createdAt,
        auditStatus: comment.auditStatus as AuditStatusEnum,
        isHidden: comment.isHidden,
      }),
    })
  }
}
