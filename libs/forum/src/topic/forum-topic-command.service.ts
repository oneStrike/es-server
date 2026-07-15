import type { DbExecutor, DbTransaction } from '@db/core'

import type { DispatchDefinedGrowthEventPayload } from '@libs/growth/growth-reward/types/growth-event-dispatch.type'
import type { BodyDoc } from '@libs/interaction/body/body.type'
import type { JsonValue } from '@libs/platform/utils'
import type {
  ApprovedTopicRewardParams,
  ForumTopicClientContext,
  TopicAuditActorOptions,
  TopicGovernanceSnapshot,
  TopicMutationSnapshot,
  TopicRestoreMutationSnapshot,
  TopicSectionSnapshot,
  TopicUpdateCurrentSnapshot,
  TopicUpdatedSnapshot,
  UpdateTopicStatusData,
  UpdateTopicStatusOptions,
} from './forum-topic.type'
import { randomUUID } from 'node:crypto'
import {
  acquireIntegrityLocks,
  DrizzleService,
  exclusiveIntegrityLock,
  sharedIntegrityLock,
  tableIntegrityLock,
} from '@db/core'
import { EventDefinitionConsumerEnum } from '@libs/growth/event-definition/event-definition.constant'
import { canConsumeEventEnvelopeByConsumer } from '@libs/growth/event-definition/event-envelope.helper'
import { GrowthBalanceQueryService } from '@libs/growth/growth-ledger/growth-balance-query.service'
import { GrowthEventBridgeService } from '@libs/growth/growth-reward/growth-event-bridge.service'
import { BodyCompilerService } from '@libs/interaction/body/body-compiler.service'
import { BodyHtmlCodecService } from '@libs/interaction/body/body-html-codec.service'
import {
  BODY_VERSION_V1,
  BodySceneEnum,
} from '@libs/interaction/body/body.constant'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { EmojiCatalogService } from '@libs/interaction/emoji/emoji-catalog.service'
import { EmojiSceneEnum } from '@libs/interaction/emoji/emoji.constant'
import { MentionSourceTypeEnum } from '@libs/interaction/mention/mention.constant'
import { MentionService } from '@libs/interaction/mention/mention.service'
import { InteractionSummaryReadService } from '@libs/interaction/summary/interaction-summary-read.service'
import { AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import { SensitiveWordReviewPolicyService } from '@libs/sensitive-word/sensitive-word-review-policy.service'
import { SensitiveWordStatisticsService } from '@libs/sensitive-word/sensitive-word-statistics.service'
import { AppUserCountService } from '@libs/user/app-user-count.service'
import { Injectable } from '@nestjs/common'
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log/action-log.constant'
import { ForumUserActionLogService } from '../action-log/action-log.service'
import { ForumCounterService } from '../counter/forum-counter.service'
import { ForumHashtagBodyService } from '../hashtag/forum-hashtag-body.service'
import { ForumHashtagReferenceService } from '../hashtag/forum-hashtag-reference.service'
import {
  ForumHashtagCreateSourceTypeEnum,
  ForumHashtagReferenceSourceTypeEnum,
} from '../hashtag/forum-hashtag.constant'
import { ForumPermissionService } from '../permission/forum-permission.service'
import {
  CreateForumTopicDto,
  MoveForumTopicDto,
  RestoreForumTopicDto,
  UpdateForumTopicAuditStatusDto,
  UpdateForumTopicDto,
  UpdateForumTopicFeaturedDto,
  UpdateForumTopicHiddenDto,
  UpdateForumTopicLockedDto,
  UpdateForumTopicPinnedDto,
} from './dto/forum-topic.dto'
import { ForumTopicServiceSupport } from './forum-topic.service.support'

export class ForumTopicSnapshotDriftError extends BusinessException {
  constructor() {
    super(BusinessErrorCode.STATE_CONFLICT, '主题状态已变化，请重试')
  }
}

@Injectable()
export class ForumTopicCommandService extends ForumTopicServiceSupport {
  constructor(
    drizzle: DrizzleService,
    forumPermissionService: ForumPermissionService,
    forumCounterService: ForumCounterService,
    forumHashtagReferenceService: ForumHashtagReferenceService,
    mentionService: MentionService,
    bodyCompilerService: BodyCompilerService,
    bodyHtmlCodecService: BodyHtmlCodecService,
    sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly sensitiveWordReviewPolicyService: SensitiveWordReviewPolicyService,
    forumHashtagBodyService: ForumHashtagBodyService,
    interactionSummaryReadService: InteractionSummaryReadService,
    growthBalanceQueryService: GrowthBalanceQueryService,
    private readonly growthEventBridgeService: GrowthEventBridgeService,
    private readonly appUserCountService: AppUserCountService,
    private readonly actionLogService: ForumUserActionLogService,
    private readonly emojiCatalogService: EmojiCatalogService,
    private readonly sensitiveWordStatisticsService: SensitiveWordStatisticsService,
  ) {
    super(
      drizzle,
      forumPermissionService,
      forumCounterService,
      forumHashtagReferenceService,
      mentionService,
      bodyCompilerService,
      bodyHtmlCodecService,
      sensitiveWordDetectService,
      forumHashtagBodyService,
      interactionSummaryReadService,
      growthBalanceQueryService,
    )
  }

  // 串行化主题可见性、锁定和删除状态的切换与其多态子引用写入。
  // 子写路径使用同一 forum_topic/id record lock，并在取得锁后重新读取主题。
  private async lockTopicForMutation(tx: DbTransaction, topicId: number) {
    await acquireIntegrityLocks(tx, [
      exclusiveIntegrityLock(tableIntegrityLock('forum_topic', topicId)),
    ])
  }

  // 创建论坛主题；写入正文、话题引用、计数、行为日志与成长事件。
  async createForumTopic(
    createTopicDto: CreateForumTopicDto,
    context: ForumTopicClientContext = {},
  ) {
    const {
      sectionId,
      userId,
      images,
      videos,
      title: inputTitle,
      html,
    } = createTopicDto
    await this.forumPermissionService.ensureUserCanCreateTopic(
      userId,
      sectionId,
    )
    const media = this.normalizeTopicMedia({ images, videos })
    const rateLimitPlan =
      this.forumPermissionService.buildTopicRateLimitLockPlan(userId)
    const topic = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        await acquireIntegrityLocks(tx, [
          sharedIntegrityLock(tableIntegrityLock('forum_section', sectionId)),
          ...rateLimitPlan.lockRequests,
        ])
        const compiledBody = await this.materializeTopicBodyInTx(
          tx,
          { html },
          userId,
        )
        const liveSection = await tx.query.forumSection.findFirst({
          where: {
            id: sectionId,
            deletedAt: { isNull: true },
            isEnabled: true,
          },
          columns: {
            id: true,
            groupId: true,
            deletedAt: true,
            isEnabled: true,
            topicReviewPolicy: true,
          },
          with: { group: { columns: { isEnabled: true, deletedAt: true } } },
        })
        if (
          !liveSection ||
          !this.forumPermissionService.isSectionPubliclyAvailable(liveSection)
        ) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '板块不存在或已禁用',
          )
        }
        await this.forumPermissionService.ensureTopicRateLimitAfterLockInTx(
          tx,
          rateLimitPlan,
        )
        const title = this.resolveCreateTopicTitle(
          inputTitle,
          compiledBody.plainText,
        )
        const decision =
          this.sensitiveWordReviewPolicyService.resolveTopicDecision(
            title,
            compiledBody.plainText,
            liveSection.topicReviewPolicy,
          )
        const createPayload = {
          title,
          html: compiledBody.html,
          content: compiledBody.plainText,
          body: compiledBody.body as unknown as JsonValue,
          contentPreview: compiledBody.contentPreview as unknown as JsonValue,
          bodyVersion: BODY_VERSION_V1,
          sectionId,
          userId,
          geoCountry: context.geoCountry,
          geoProvince: context.geoProvince,
          geoCity: context.geoCity,
          geoIsp: context.geoIsp,
          geoSource: context.geoSource,
          ...media,
          auditStatus: decision.auditStatus,
          sensitiveWordHits: decision.publicHits.length
            ? decision.publicHits
            : undefined,
          isHidden: decision.isHidden,
        }
        const [newTopic] = await tx
          .insert(this.forumTopicTable)
          .values(createPayload)
          .returning({
            id: this.forumTopicTable.id,
            userId: this.forumTopicTable.userId,
            title: this.forumTopicTable.title,
            auditStatus: this.forumTopicTable.auditStatus,
            isHidden: this.forumTopicTable.isHidden,
            deletedAt: this.forumTopicTable.deletedAt,
            createdAt: this.forumTopicTable.createdAt,
          })
        if (decision.recordHits && decision.statisticsHits.length) {
          await this.sensitiveWordStatisticsService.recordEntityHitsInTx(tx, {
            entityType: 'topic',
            entityId: newTopic.id,
            operationType: 'create',
            hits: decision.statisticsHits,
            occurredAt: newTopic.createdAt,
          })
        }
        await this.mentionService.replaceMentionsInTx({
          tx,
          sourceType: MentionSourceTypeEnum.FORUM_TOPIC,
          sourceId: newTopic.id,
          content: compiledBody.plainText,
          mentions: compiledBody.mentionFacts,
        })
        await this.emojiCatalogService.recordRecentUsageInTx(tx, {
          userId,
          scene: EmojiSceneEnum.FORUM,
          items: compiledBody.emojiRecentUsageItems,
        })
        await this.forumHashtagReferenceService.replaceReferencesInTx({
          tx,
          sourceType: ForumHashtagReferenceSourceTypeEnum.TOPIC,
          sourceId: newTopic.id,
          topicId: newTopic.id,
          sectionId,
          userId,
          sourceAuditStatus: newTopic.auditStatus,
          sourceIsHidden: newTopic.isHidden,
          isSourceVisible: this.isTopicVisible({
            auditStatus: newTopic.auditStatus,
            isHidden: newTopic.isHidden,
            deletedAt: newTopic.deletedAt,
          }),
          hashtagFacts: compiledBody.hashtagFacts,
        })
        await this.forumCounterService.updateUserForumTopicCount(tx, userId, 1)
        await this.forumCounterService.syncSectionVisibleState(tx, sectionId)
        if (
          this.isTopicVisible({
            auditStatus: newTopic.auditStatus,
            isHidden: newTopic.isHidden,
            deletedAt: newTopic.deletedAt,
          })
        ) {
          await this.mentionService.dispatchTopicMentionsInTx(tx, {
            topicId: newTopic.id,
            actorUserId: userId,
            topicTitle: newTopic.title,
          })
        }
        const { deletedAt, ...data } = newTopic
        return data
      }),
    )
    await this.actionLogService.createActionLog({
      userId,
      actionType: ForumUserActionTypeEnum.CREATE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: topic.id,
      afterData: JSON.stringify(topic),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      geoCountry: context.geoCountry,
      geoProvince: context.geoProvince,
      geoCity: context.geoCity,
      geoIsp: context.geoIsp,
      geoSource: context.geoSource,
    })
    const topicCreatedEvent = this.buildCreateTopicEventEnvelope({
      topicId: topic.id,
      userId,
      auditStatus: topic.auditStatus,
      occurredAt: topic.createdAt,
      context: { sectionId, auditStatus: topic.auditStatus },
    })
    if (
      canConsumeEventEnvelopeByConsumer(
        topicCreatedEvent,
        EventDefinitionConsumerEnum.GROWTH,
      )
    ) {
      await this.growthEventBridgeService.dispatchDefinedEvent({
        eventEnvelope: topicCreatedEvent,
        bizKey: `forum:topic:create:${topic.id}:user:${userId}`,
        source: 'forum_topic',
      })
    }
    return { id: topic.id }
  }

  // 基于当前主题快照更新主题内容，并同步审核、话题、mention 与日志。
  private async updateTopicWithCurrent(
    topic: TopicUpdateCurrentSnapshot,
    updateForumTopicDto: UpdateForumTopicDto,
    context: ForumTopicClientContext = {},
    actorUserId = topic.userId,
    options: {
      recordUserActionLog?: boolean
      afterUpdateInTx?: (
        tx: DbExecutor,
        nextTopic: TopicUpdatedSnapshot,
      ) => Promise<void>
    } = {},
  ) {
    const {
      id,
      images,
      videos,
      title: nextTitleInput,
      html,
    } = updateForumTopicDto
    if (topic.isLocked) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '主题已锁定，无法编辑',
      )
    }
    let beforeTopic = topic
    const updatedTopic = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const compiledBody = await this.materializeTopicBodyInTx(
          tx,
          { html },
          actorUserId,
        )
        await this.lockTopicForMutation(tx, id)
        const lockedTopic = await tx.query.forumTopic.findFirst({
          where: {
            id,
            deletedAt: { isNull: true },
          },
        })
        if (!lockedTopic) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '主题不存在',
          )
        }
        if (lockedTopic.isLocked) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '主题已锁定，无法编辑',
          )
        }
        beforeTopic = lockedTopic
        const reviewPolicy = await this.getSectionTopicReviewPolicy(
          lockedTopic.sectionId,
          {
            client: tx,
            notFoundMessage: '主题所属板块不存在',
          },
        )
        const media = this.normalizeTopicMedia(
          { images, videos },
          { images: lockedTopic.images, videos: lockedTopic.videos },
        )
        const nextTitle = this.resolveUpdateTopicTitle(
          lockedTopic.title,
          nextTitleInput,
        )
        const nextContent = compiledBody.plainText
        const decision =
          this.sensitiveWordReviewPolicyService.resolveTopicDecision(
            nextTitle,
            nextContent,
            reviewPolicy,
          )
        const updatePayload = {
          title: nextTitle,
          html: compiledBody.html,
          content: compiledBody.plainText,
          body: compiledBody.body as unknown as JsonValue,
          contentPreview: compiledBody.contentPreview as unknown as JsonValue,
          ...media,
          bodyVersion: BODY_VERSION_V1,
          auditStatus: decision.auditStatus,
          sensitiveWordHits: decision.publicHits.length
            ? decision.publicHits
            : null,
          isHidden: decision.isHidden,
        }
        const [nextTopic] = await tx
          .update(this.forumTopicTable)
          .set(updatePayload)
          .where(
            and(
              eq(this.forumTopicTable.id, id),
              isNull(this.forumTopicTable.deletedAt),
            ),
          )
          .returning({
            id: this.forumTopicTable.id,
            sectionId: this.forumTopicTable.sectionId,
            userId: this.forumTopicTable.userId,
            title: this.forumTopicTable.title,
            auditStatus: this.forumTopicTable.auditStatus,
            isHidden: this.forumTopicTable.isHidden,
            deletedAt: this.forumTopicTable.deletedAt,
            updatedAt: this.forumTopicTable.updatedAt,
          })
        if (!nextTopic) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '主题不存在',
          )
        }
        if (decision.recordHits && decision.statisticsHits.length) {
          await this.sensitiveWordStatisticsService.recordEntityHitsInTx(tx, {
            entityType: 'topic',
            entityId: nextTopic.id,
            operationType: 'update',
            hits: decision.statisticsHits,
            occurredAt: nextTopic.updatedAt ?? new Date(),
          })
        }
        await this.mentionService.replaceMentionsInTx({
          tx,
          sourceType: MentionSourceTypeEnum.FORUM_TOPIC,
          sourceId: nextTopic.id,
          content: compiledBody.plainText,
          mentions: compiledBody.mentionFacts,
        })
        await this.emojiCatalogService.recordRecentUsageInTx(tx, {
          userId: actorUserId,
          scene: EmojiSceneEnum.FORUM,
          items: compiledBody.emojiRecentUsageItems,
        })
        await this.forumHashtagReferenceService.replaceReferencesInTx({
          tx,
          sourceType: ForumHashtagReferenceSourceTypeEnum.TOPIC,
          sourceId: nextTopic.id,
          topicId: nextTopic.id,
          sectionId: lockedTopic.sectionId,
          userId: nextTopic.userId,
          sourceAuditStatus: nextTopic.auditStatus,
          sourceIsHidden: nextTopic.isHidden,
          isSourceVisible: this.isTopicVisible({
            auditStatus: nextTopic.auditStatus,
            isHidden: nextTopic.isHidden,
            deletedAt: nextTopic.deletedAt,
          }),
          hashtagFacts: compiledBody.hashtagFacts,
        })
        await this.forumCounterService.syncSectionVisibleState(
          tx,
          lockedTopic.sectionId,
        )
        await this.forumHashtagReferenceService.syncCommentVisibilityByTopicInTx(
          tx,
          nextTopic.id,
          this.isTopicVisible({
            auditStatus: nextTopic.auditStatus,
            isHidden: nextTopic.isHidden,
            deletedAt: nextTopic.deletedAt,
          }),
        )
        if (
          this.isTopicVisible({
            auditStatus: nextTopic.auditStatus,
            isHidden: nextTopic.isHidden,
            deletedAt: nextTopic.deletedAt,
          })
        ) {
          await this.mentionService.dispatchTopicMentionsInTx(tx, {
            topicId: nextTopic.id,
            actorUserId,
            topicTitle: nextTopic.title,
          })
        }
        await options.afterUpdateInTx?.(tx, nextTopic)
        return nextTopic
      }),
    )
    if (options.recordUserActionLog !== false) {
      await this.actionLogService.createActionLog({
        userId: beforeTopic.userId,
        actionType: ForumUserActionTypeEnum.UPDATE_TOPIC,
        targetType: ForumUserActionTargetTypeEnum.TOPIC,
        targetId: id,
        beforeData: JSON.stringify(beforeTopic),
        afterData: JSON.stringify(updatedTopic),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        geoCountry: context.geoCountry,
        geoProvince: context.geoProvince,
        geoCity: context.geoCity,
        geoIsp: context.geoIsp,
        geoSource: context.geoSource,
      })
    }
    return true
  }

  // 管理端更新主题内容；默认以主题作者作为行为主体。
  async updateTopic(
    updateForumTopicDto: UpdateForumTopicDto,
    context: ForumTopicClientContext = {},
    actorUserId?: number,
    options: {
      recordUserActionLog?: boolean
      afterUpdateInTx?: (
        tx: DbExecutor,
        nextTopic: TopicUpdatedSnapshot,
      ) => Promise<void>
    } = {},
  ) {
    const topic = await this.getActiveTopicOrThrow(updateForumTopicDto.id)
    return this.updateTopicWithCurrent(
      topic,
      updateForumTopicDto,
      context,
      actorUserId ?? topic.userId,
      options,
    )
  }

  // 基于当前主题快照删除主题，并在事务中同步评论、引用和计数。
  private async deleteTopicWithCurrent(
    topic: TopicMutationSnapshot,
    context: ForumTopicClientContext = {},
    actorUserId = topic.userId,
  ) {
    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        await this.deleteTopicWithCurrentInTx(tx, topic, context, actorUserId)
      }),
    )
    return true
  }

  // 在既有事务中删除主题；供治理链路复用同一事务边界。
  async deleteTopicWithCurrentInTx(
    tx: DbTransaction,
    topic: TopicMutationSnapshot,
    context: ForumTopicClientContext = {},
    actorUserId = topic.userId,
    options: { recordUserActionLog?: boolean } = {},
  ) {
    const { id } = topic
    const deletedAt = new Date()
    const topicDeleteCascadeId = `topic-delete:${id}:${randomUUID()}`
    await this.lockTopicForMutation(tx, id)
    const lockedTopic = await tx.query.forumTopic.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
    })
    if (!lockedTopic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }
    const commentUserSummaries = await tx
      .select({
        userId: this.userCommentTable.userId,
        commentCount: sql<number>`count(*)::int`.mapWith(Number),
        receivedLikeCount:
          sql<number>`coalesce(sum(${this.userCommentTable.likeCount}), 0)::int`.mapWith(
            Number,
          ),
      })
      .from(this.userCommentTable)
      .where(
        and(
          eq(
            this.userCommentTable.targetType,
            CommentTargetTypeEnum.FORUM_TOPIC,
          ),
          eq(this.userCommentTable.targetId, id),
          isNull(this.userCommentTable.deletedAt),
        ),
      )
      .groupBy(this.userCommentTable.userId)

    await tx
      .update(this.userCommentTable)
      .set({ deletedAt, topicDeleteCascadeId })
      .where(
        and(
          eq(
            this.userCommentTable.targetType,
            CommentTargetTypeEnum.FORUM_TOPIC,
          ),
          eq(this.userCommentTable.targetId, id),
          isNull(this.userCommentTable.deletedAt),
        ),
      )
    const result = await tx
      .update(this.forumTopicTable)
      .set({ deletedAt })
      .where(
        and(
          eq(this.forumTopicTable.id, id),
          isNull(this.forumTopicTable.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '主题不存在')
    await this.mentionService.deleteMentionsInTx({
      tx,
      sourceType: MentionSourceTypeEnum.FORUM_TOPIC,
      sourceIds: [id],
    })
    await this.forumHashtagReferenceService.deleteReferencesInTx({
      tx,
      sourceType: ForumHashtagReferenceSourceTypeEnum.TOPIC,
      sourceIds: [id],
    })
    await this.mentionService.deleteCommentMentionsByForumTopicInTx(tx, id)
    await this.forumHashtagReferenceService.deleteCommentReferencesByTopicInTx(
      tx,
      id,
    )

    await this.forumCounterService.updateUserForumTopicCount(
      tx,
      lockedTopic.userId,
      -1,
    )
    if (lockedTopic.likeCount > 0) {
      await this.forumCounterService.updateUserForumTopicReceivedLikeCount(
        tx,
        lockedTopic.userId,
        -lockedTopic.likeCount,
      )
    }
    if (lockedTopic.favoriteCount > 0) {
      await this.forumCounterService.updateUserForumTopicReceivedFavoriteCount(
        tx,
        lockedTopic.userId,
        -lockedTopic.favoriteCount,
      )
    }
    const commentCountTasks: Promise<void>[] = []
    for (const summary of commentUserSummaries) {
      commentCountTasks.push(
        this.appUserCountService.updateCommentCount(
          tx,
          summary.userId,
          -summary.commentCount,
        ),
      )
      if (summary.receivedLikeCount > 0) {
        commentCountTasks.push(
          this.appUserCountService.updateCommentReceivedLikeCount(
            tx,
            summary.userId,
            -summary.receivedLikeCount,
          ),
        )
      }
    }
    await Promise.all(commentCountTasks)
    await this.forumCounterService.syncSectionVisibleState(
      tx,
      lockedTopic.sectionId,
    )
    if (options.recordUserActionLog !== false) {
      await this.actionLogService.createActionLogInTx(tx, {
        userId: actorUserId,
        actionType: ForumUserActionTypeEnum.DELETE_TOPIC,
        targetType: ForumUserActionTargetTypeEnum.TOPIC,
        targetId: lockedTopic.id,
        beforeData: JSON.stringify(lockedTopic),
        afterData: JSON.stringify({ topicDeleteCascadeId }),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        geoCountry: context.geoCountry,
        geoProvince: context.geoProvince,
        geoCity: context.geoCity,
        geoIsp: context.geoIsp,
        geoSource: context.geoSource,
      })
    }
    return true
  }

  // 管理端删除主题；默认以主题作者作为行为主体。
  async deleteTopic(
    id: number,
    context: ForumTopicClientContext = {},
    actorUserId?: number,
  ) {
    const topic = await this.getActiveTopicOrThrow(id)
    return this.deleteTopicWithCurrent(
      topic,
      context,
      actorUserId ?? topic.userId,
    )
  }

  private async getDeletedTopicOrThrow(id: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id,
      },
      columns: {
        id: true,
        sectionId: true,
        userId: true,
        deletedAt: true,
      },
    })

    if (!topic || topic.deletedAt === null) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '已删除主题不存在',
      )
    }

    return topic
  }

  async restoreTopic(
    input: RestoreForumTopicDto,
    context: ForumTopicClientContext = {},
    actorUserId?: number,
  ) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const topic = await this.getDeletedTopicOrThrow(input.id)
      try {
        await this.drizzle.withErrorHandling(async () =>
          this.db.transaction(async (tx) =>
            this.restoreTopicWithCurrentInTx(
              tx,
              topic,
              input,
              context,
              actorUserId ?? topic.userId,
            ),
          ),
        )
        return true
      } catch (error) {
        if (!(error instanceof ForumTopicSnapshotDriftError) || attempt === 1) {
          throw error
        }
      }
    }

    throw new ForumTopicSnapshotDriftError()
  }

  async restoreTopicWithCurrentInTx(
    tx: DbTransaction,
    topic: TopicRestoreMutationSnapshot,
    input: RestoreForumTopicDto,
    context: ForumTopicClientContext = {},
    actorUserId = topic.userId,
    options: { recordUserActionLog?: boolean } = {},
  ) {
    const nextSectionId = input.sectionId ?? topic.sectionId
    await acquireIntegrityLocks(tx, [
      exclusiveIntegrityLock(tableIntegrityLock('forum_topic', topic.id)),
      sharedIntegrityLock(tableIntegrityLock('forum_section', topic.sectionId)),
      sharedIntegrityLock(tableIntegrityLock('forum_section', nextSectionId)),
    ])
    const currentTopic = await tx.query.forumTopic.findFirst({
      where: { id: topic.id },
      columns: {
        id: true,
        sectionId: true,
        userId: true,
        title: true,
        body: true,
        isHidden: true,
        auditStatus: true,
        likeCount: true,
        favoriteCount: true,
        deletedAt: true,
      },
    })
    if (!currentTopic || currentTopic.deletedAt === null) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '已删除主题不存在',
      )
    }
    if (currentTopic.sectionId !== topic.sectionId) {
      throw new ForumTopicSnapshotDriftError()
    }
    await this.getSectionTopicReviewPolicy(nextSectionId, {
      client: tx,
      requireEnabled: true,
      notFoundMessage: '目标板块不存在或已禁用',
    })

    const cascadeRows = await tx
      .select({
        topicDeleteCascadeId: this.userCommentTable.topicDeleteCascadeId,
      })
      .from(this.userCommentTable)
      .where(
        and(
          eq(
            this.userCommentTable.targetType,
            CommentTargetTypeEnum.FORUM_TOPIC,
          ),
          eq(this.userCommentTable.targetId, currentTopic.id),
          isNotNull(this.userCommentTable.deletedAt),
          isNotNull(this.userCommentTable.topicDeleteCascadeId),
        ),
      )
      .limit(1)

    const topicDeleteCascadeId = cascadeRows[0]?.topicDeleteCascadeId ?? null
    const restoredComments = topicDeleteCascadeId
      ? await tx
          .select({
            auditStatus: this.userCommentTable.auditStatus,
            body: this.userCommentTable.body,
            id: this.userCommentTable.id,
            isHidden: this.userCommentTable.isHidden,
            userId: this.userCommentTable.userId,
          })
          .from(this.userCommentTable)
          .where(
            and(
              eq(
                this.userCommentTable.targetType,
                CommentTargetTypeEnum.FORUM_TOPIC,
              ),
              eq(this.userCommentTable.targetId, currentTopic.id),
              eq(
                this.userCommentTable.topicDeleteCascadeId,
                topicDeleteCascadeId,
              ),
              isNotNull(this.userCommentTable.deletedAt),
            ),
          )
      : []
    const restoredCommentSummaries = topicDeleteCascadeId
      ? await tx
          .select({
            userId: this.userCommentTable.userId,
            commentCount: sql<number>`count(*)::int`.mapWith(Number),
            receivedLikeCount:
              sql<number>`coalesce(sum(${this.userCommentTable.likeCount}), 0)::int`.mapWith(
                Number,
              ),
          })
          .from(this.userCommentTable)
          .where(
            and(
              eq(
                this.userCommentTable.targetType,
                CommentTargetTypeEnum.FORUM_TOPIC,
              ),
              eq(this.userCommentTable.targetId, currentTopic.id),
              eq(
                this.userCommentTable.topicDeleteCascadeId,
                topicDeleteCascadeId,
              ),
              isNotNull(this.userCommentTable.deletedAt),
            ),
          )
          .groupBy(this.userCommentTable.userId)
      : []

    const result = await tx
      .update(this.forumTopicTable)
      .set({ deletedAt: null, sectionId: nextSectionId })
      .where(
        and(
          eq(this.forumTopicTable.id, currentTopic.id),
          isNotNull(this.forumTopicTable.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '已删除主题不存在')

    if (topicDeleteCascadeId) {
      await tx
        .update(this.userCommentTable)
        .set({ deletedAt: null, topicDeleteCascadeId: null })
        .where(
          and(
            eq(
              this.userCommentTable.targetType,
              CommentTargetTypeEnum.FORUM_TOPIC,
            ),
            eq(this.userCommentTable.targetId, currentTopic.id),
            eq(
              this.userCommentTable.topicDeleteCascadeId,
              topicDeleteCascadeId,
            ),
            isNotNull(this.userCommentTable.deletedAt),
          ),
        )
    }

    const materialized = await this.forumHashtagBodyService.materializeBodyInTx(
      {
        tx,
        body: currentTopic.body as BodyDoc,
        actorUserId,
        createSourceType: ForumHashtagCreateSourceTypeEnum.TOPIC_BODY,
      },
    )
    const compiledBody = await this.bodyCompilerService.compile(
      materialized.body,
      BodySceneEnum.TOPIC,
    )
    const isVisible = this.isTopicVisible({
      auditStatus: currentTopic.auditStatus,
      isHidden: currentTopic.isHidden,
      deletedAt: null,
    })
    await this.mentionService.replaceMentionsInTx({
      tx,
      sourceType: MentionSourceTypeEnum.FORUM_TOPIC,
      sourceId: currentTopic.id,
      content: compiledBody.plainText,
      mentions: compiledBody.mentionFacts,
    })
    await this.forumHashtagReferenceService.replaceReferencesInTx({
      tx,
      sourceType: ForumHashtagReferenceSourceTypeEnum.TOPIC,
      sourceId: currentTopic.id,
      topicId: currentTopic.id,
      sectionId: nextSectionId,
      userId: currentTopic.userId,
      sourceAuditStatus: currentTopic.auditStatus,
      sourceIsHidden: currentTopic.isHidden,
      isSourceVisible: isVisible,
      hashtagFacts: materialized.hashtagFacts,
    })
    await this.rebuildRestoredCommentReferencesInTx({
      tx,
      comments: restoredComments,
      topicId: currentTopic.id,
      sectionId: nextSectionId,
      parentTopicVisible: isVisible,
      actorUserId,
    })

    await this.forumCounterService.updateUserForumTopicCount(
      tx,
      currentTopic.userId,
      1,
    )
    if (currentTopic.likeCount > 0) {
      await this.forumCounterService.updateUserForumTopicReceivedLikeCount(
        tx,
        currentTopic.userId,
        currentTopic.likeCount,
      )
    }
    if (currentTopic.favoriteCount > 0) {
      await this.forumCounterService.updateUserForumTopicReceivedFavoriteCount(
        tx,
        currentTopic.userId,
        currentTopic.favoriteCount,
      )
    }
    const commentCountTasks: Promise<void>[] = []
    for (const summary of restoredCommentSummaries) {
      commentCountTasks.push(
        this.appUserCountService.updateCommentCount(
          tx,
          summary.userId,
          summary.commentCount,
        ),
      )
      if (summary.receivedLikeCount > 0) {
        commentCountTasks.push(
          this.appUserCountService.updateCommentReceivedLikeCount(
            tx,
            summary.userId,
            summary.receivedLikeCount,
          ),
        )
      }
    }
    await Promise.all(commentCountTasks)
    await this.forumCounterService.syncSectionVisibleState(
      tx,
      currentTopic.sectionId,
    )
    if (nextSectionId !== currentTopic.sectionId) {
      await this.forumCounterService.syncSectionVisibleState(tx, nextSectionId)
    }
    if (isVisible) {
      await this.mentionService.dispatchTopicMentionsInTx(tx, {
        topicId: currentTopic.id,
        actorUserId,
        topicTitle: currentTopic.title,
      })
    }
    if (options.recordUserActionLog !== false) {
      await this.actionLogService.createActionLogInTx(tx, {
        userId: actorUserId,
        actionType: ForumUserActionTypeEnum.UPDATE_TOPIC,
        targetType: ForumUserActionTargetTypeEnum.TOPIC,
        targetId: currentTopic.id,
        beforeData: JSON.stringify({
          deletedAt: currentTopic.deletedAt,
          sectionId: currentTopic.sectionId,
        }),
        afterData: JSON.stringify({
          deletedAt: null,
          restoredCommentCascadeId: topicDeleteCascadeId,
          sectionId: nextSectionId,
        }),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        geoCountry: context.geoCountry,
        geoProvince: context.geoProvince,
        geoCity: context.geoCity,
        geoIsp: context.geoIsp,
        geoSource: context.geoSource,
      })
    }
    return true
  }

  private async rebuildRestoredCommentReferencesInTx(input: {
    tx: DbExecutor
    comments: Array<{
      auditStatus: number
      body: unknown
      id: number
      isHidden: boolean
      userId: number
    }>
    topicId: number
    sectionId: number
    parentTopicVisible: boolean
    actorUserId: number
  }) {
    for (const comment of input.comments) {
      const materialized =
        await this.forumHashtagBodyService.materializeBodyInTx({
          tx: input.tx,
          body: comment.body as BodyDoc,
          actorUserId: input.actorUserId,
          createSourceType: ForumHashtagCreateSourceTypeEnum.COMMENT_BODY,
        })
      const compiledBody = await this.bodyCompilerService.compile(
        materialized.body,
        BodySceneEnum.COMMENT,
      )
      await this.mentionService.replaceMentionsInTx({
        tx: input.tx,
        sourceType: MentionSourceTypeEnum.COMMENT,
        sourceId: comment.id,
        content: compiledBody.plainText,
        mentions: compiledBody.mentionFacts,
      })
      await this.forumHashtagReferenceService.replaceReferencesInTx({
        tx: input.tx,
        sourceType: ForumHashtagReferenceSourceTypeEnum.COMMENT,
        sourceId: comment.id,
        topicId: input.topicId,
        sectionId: input.sectionId,
        userId: comment.userId,
        sourceAuditStatus: comment.auditStatus,
        sourceIsHidden: comment.isHidden,
        isSourceVisible:
          input.parentTopicVisible &&
          this.isTopicVisible({
            auditStatus: comment.auditStatus,
            isHidden: comment.isHidden,
            deletedAt: null,
          }),
        hashtagFacts: materialized.hashtagFacts,
      })
    }
  }

  // 移动主题到目标板块，并同步源板块与目标板块的可见计数。
  async moveTopic(input: MoveForumTopicDto) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const currentTopic = await this.db.query.forumTopic.findFirst({
        where: { id: input.id, deletedAt: { isNull: true } },
        columns: { id: true, sectionId: true },
      })
      if (!currentTopic) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '主题不存在',
        )
      }
      if (currentTopic.sectionId === input.sectionId) {
        return true
      }
      await this.getSectionTopicReviewPolicy(input.sectionId, {
        requireEnabled: true,
        notFoundMessage: '目标板块不存在或已禁用',
      })

      try {
        await this.drizzle.withErrorHandling(async () =>
          this.db.transaction(async (tx) => {
            await this.moveTopicInTx(tx, input, currentTopic.sectionId)
          }),
        )
        return true
      } catch (error) {
        if (!(error instanceof ForumTopicSnapshotDriftError) || attempt === 1) {
          throw error
        }
      }
    }

    throw new ForumTopicSnapshotDriftError()
  }

  // 在既有事务中移动主题；用于治理批量操作保持事务一致性。
  async moveTopicInTx(
    tx: DbTransaction,
    input: MoveForumTopicDto,
    currentSectionId: number,
  ) {
    await acquireIntegrityLocks(tx, [
      exclusiveIntegrityLock(tableIntegrityLock('forum_topic', input.id)),
      sharedIntegrityLock(
        tableIntegrityLock('forum_section', currentSectionId),
      ),
      sharedIntegrityLock(tableIntegrityLock('forum_section', input.sectionId)),
    ])
    const currentTopic = await tx.query.forumTopic.findFirst({
      where: { id: input.id, deletedAt: { isNull: true } },
      columns: { sectionId: true },
    })
    if (!currentTopic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }
    if (currentTopic.sectionId !== currentSectionId) {
      throw new ForumTopicSnapshotDriftError()
    }
    const sourceSectionId = currentSectionId
    if (sourceSectionId === input.sectionId) {
      return true
    }
    await this.getSectionTopicReviewPolicy(input.sectionId, {
      client: tx,
      requireEnabled: true,
      notFoundMessage: '目标板块不存在或已禁用',
    })
    const result = await tx
      .update(this.forumTopicTable)
      .set({ sectionId: input.sectionId })
      .where(
        and(
          eq(this.forumTopicTable.id, input.id),
          eq(this.forumTopicTable.sectionId, sourceSectionId),
          isNull(this.forumTopicTable.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '主题不存在')
    await this.forumHashtagReferenceService.syncSectionIdsByTopicInTx(
      tx,
      input.id,
      input.sectionId,
    )
    await Promise.all([
      this.forumCounterService.syncSectionVisibleState(tx, sourceSectionId),
      this.forumCounterService.syncSectionVisibleState(tx, input.sectionId),
    ])
    return true
  }

  // 更新主题布尔状态字段，并按需同步板块可见状态。
  private async updateTopicStatus(
    id: number,
    updateData: UpdateTopicStatusData,
    options?: UpdateTopicStatusOptions,
  ) {
    const currentTopic = await this.db.query.forumTopic.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: { sectionId: true },
    })
    if (!currentTopic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }
    return this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) =>
        this.updateTopicStatusInTx(
          tx,
          id,
          updateData,
          options,
          currentTopic.sectionId,
        ),
      ),
    )
  }

  // 在既有事务中更新主题状态字段，供治理链路复用。
  async updateTopicStatusInTx(
    tx: DbTransaction,
    id: number,
    updateData: UpdateTopicStatusData,
    options?: UpdateTopicStatusOptions,
    sectionId?: number,
  ) {
    let lockedTopic: TopicSectionSnapshot | null = null
    if (updateData.isLocked !== undefined) {
      await this.lockTopicForMutation(tx, id)
      lockedTopic = await this.getActiveTopicByIdInTx(tx, id)
    }
    const currentSectionId =
      lockedTopic?.sectionId ??
      sectionId ??
      (
        await tx.query.forumTopic.findFirst({
          where: { id, deletedAt: { isNull: true } },
          columns: { sectionId: true },
        })
      )?.sectionId
    if (!currentSectionId) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }
    const result = await tx
      .update(this.forumTopicTable)
      .set(updateData)
      .where(
        and(
          eq(this.forumTopicTable.id, id),
          isNull(this.forumTopicTable.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '主题不存在')
    if (options?.syncSectionVisibility) {
      await this.forumCounterService.syncSectionVisibleState(
        tx,
        currentSectionId,
      )
    }
    return true
  }

  // 更新主题置顶状态。
  async updateTopicPinned(updateTopicPinnedDto: UpdateForumTopicPinnedDto) {
    return this.updateTopicStatus(updateTopicPinnedDto.id, {
      isPinned: updateTopicPinnedDto.isPinned,
    })
  }

  // 在既有事务中更新主题置顶状态。
  async updateTopicPinnedInTx(
    tx: DbTransaction,
    updateTopicPinnedDto: UpdateForumTopicPinnedDto,
  ) {
    return this.updateTopicStatusInTx(tx, updateTopicPinnedDto.id, {
      isPinned: updateTopicPinnedDto.isPinned,
    })
  }

  // 更新主题精华状态。
  async updateTopicFeatured(
    updateTopicFeaturedDto: UpdateForumTopicFeaturedDto,
  ) {
    return this.updateTopicStatus(updateTopicFeaturedDto.id, {
      isFeatured: updateTopicFeaturedDto.isFeatured,
    })
  }

  // 在既有事务中更新主题精华状态。
  async updateTopicFeaturedInTx(
    tx: DbTransaction,
    updateTopicFeaturedDto: UpdateForumTopicFeaturedDto,
  ) {
    return this.updateTopicStatusInTx(tx, updateTopicFeaturedDto.id, {
      isFeatured: updateTopicFeaturedDto.isFeatured,
    })
  }

  // 更新主题锁定状态。
  async updateTopicLocked(updateTopicLockedDto: UpdateForumTopicLockedDto) {
    return this.updateTopicStatus(updateTopicLockedDto.id, {
      isLocked: updateTopicLockedDto.isLocked,
    })
  }

  // 在既有事务中更新主题锁定状态。
  async updateTopicLockedInTx(
    tx: DbTransaction,
    updateTopicLockedDto: UpdateForumTopicLockedDto,
  ) {
    return this.updateTopicStatusInTx(tx, updateTopicLockedDto.id, {
      isLocked: updateTopicLockedDto.isLocked,
    })
  }

  // 更新主题隐藏状态，并同步可见性相关引用与 mention。
  async updateTopicHidden(updateTopicHiddenDto: UpdateForumTopicHiddenDto) {
    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) =>
        this.updateTopicHiddenInTx(tx, updateTopicHiddenDto),
      ),
    )
    return true
  }

  // 在既有事务中更新主题隐藏状态；供治理链路复用。
  async updateTopicHiddenInTx(
    tx: DbTransaction,
    updateTopicHiddenDto: UpdateForumTopicHiddenDto,
    _currentTopic?: TopicGovernanceSnapshot,
  ) {
    await this.lockTopicForMutation(tx, updateTopicHiddenDto.id)
    const topic = await tx.query.forumTopic.findFirst({
      where: { id: updateTopicHiddenDto.id, deletedAt: { isNull: true } },
      columns: {
        id: true,
        sectionId: true,
        userId: true,
        title: true,
        auditStatus: true,
        isHidden: true,
      },
    })
    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }
    const result = await tx
      .update(this.forumTopicTable)
      .set({ isHidden: updateTopicHiddenDto.isHidden })
      .where(
        and(
          eq(this.forumTopicTable.id, updateTopicHiddenDto.id),
          isNull(this.forumTopicTable.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '主题不存在')
    await this.forumCounterService.syncSectionVisibleState(tx, topic.sectionId)
    await this.forumHashtagReferenceService.syncSourceVisibilityInTx({
      tx,
      sourceType: ForumHashtagReferenceSourceTypeEnum.TOPIC,
      sourceId: topic.id,
      sourceAuditStatus: topic.auditStatus,
      sourceIsHidden: updateTopicHiddenDto.isHidden,
      isSourceVisible: this.isTopicVisible({
        auditStatus: topic.auditStatus,
        isHidden: updateTopicHiddenDto.isHidden,
        deletedAt: null,
      }),
    })
    await this.forumHashtagReferenceService.syncCommentVisibilityByTopicInTx(
      tx,
      topic.id,
      this.isTopicVisible({
        auditStatus: topic.auditStatus,
        isHidden: updateTopicHiddenDto.isHidden,
        deletedAt: null,
      }),
    )
    await this.syncTopicMentionVisibilityTransitionInTx(tx, {
      topicId: topic.id,
      actorUserId: topic.userId,
      topicTitle: topic.title,
      currentAuditStatus: topic.auditStatus,
      currentIsHidden: topic.isHidden,
      nextAuditStatus: topic.auditStatus,
      nextIsHidden: updateTopicHiddenDto.isHidden,
    })
    return true
  }

  // 当主题从待审核变为已通过时补发创建主题奖励事件。
  private async dispatchApprovedTopicRewardIfNeeded(
    params: ApprovedTopicRewardParams,
  ) {
    const payload = this.buildApprovedTopicGrowthEventPayload(params)
    if (!payload) {
      return
    }
    await this.growthEventBridgeService.dispatchDefinedEvent(payload)
  }

  // 构建审核通过主题的成长奖励 payload，供治理链路在事务内补建 settlement 事实。
  buildApprovedTopicGrowthEventPayload(
    params: ApprovedTopicRewardParams,
  ): DispatchDefinedGrowthEventPayload | null {
    if (
      params.previousAuditStatus !== AuditStatusEnum.PENDING ||
      params.nextAuditStatus !== AuditStatusEnum.APPROVED
    ) {
      return null
    }
    const topicApprovedEvent = this.buildCreateTopicEventEnvelope({
      topicId: params.topicId,
      userId: params.userId,
      auditStatus: params.nextAuditStatus,
      context: {
        previousAuditStatus: params.previousAuditStatus,
        nextAuditStatus: params.nextAuditStatus,
      },
    })
    if (
      !canConsumeEventEnvelopeByConsumer(
        topicApprovedEvent,
        EventDefinitionConsumerEnum.GROWTH,
      )
    ) {
      return null
    }

    return {
      eventEnvelope: topicApprovedEvent,
      bizKey: `forum:topic:create:${params.topicId}:user:${params.userId}`,
      source: 'forum_topic',
    }
  }

  // 更新主题审核状态，并在审核通过时补发成长奖励。
  async updateTopicAuditStatus(
    updateTopicAuditStatusDto: UpdateForumTopicAuditStatusDto,
    options?: TopicAuditActorOptions,
  ) {
    const previousTopic = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) =>
        this.updateTopicAuditStatusInTx(tx, updateTopicAuditStatusDto, options),
      ),
    )
    await this.dispatchApprovedTopicRewardIfNeeded({
      topicId: previousTopic.id,
      userId: previousTopic.userId,
      previousAuditStatus: previousTopic.auditStatus,
      nextAuditStatus: updateTopicAuditStatusDto.auditStatus,
    })
    return true
  }

  // 在既有事务中更新主题审核状态并同步可见性。
  async updateTopicAuditStatusInTx(
    tx: DbTransaction,
    updateTopicAuditStatusDto: UpdateForumTopicAuditStatusDto,
    options?: TopicAuditActorOptions,
    _currentTopic?: TopicGovernanceSnapshot,
  ) {
    const { id, auditStatus, auditReason } = updateTopicAuditStatusDto
    await this.lockTopicForMutation(tx, id)
    const topic = await tx.query.forumTopic.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: {
        id: true,
        sectionId: true,
        userId: true,
        title: true,
        auditStatus: true,
        isHidden: true,
      },
    })
    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }
    const result = await tx
      .update(this.forumTopicTable)
      .set({
        auditStatus,
        auditReason,
        auditById: options?.auditById ?? null,
        auditRole: options?.auditRole ?? null,
        auditAt: new Date(),
      })
      .where(
        and(
          eq(this.forumTopicTable.id, id),
          isNull(this.forumTopicTable.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '主题不存在')
    await this.forumCounterService.syncSectionVisibleState(tx, topic.sectionId)
    await this.forumHashtagReferenceService.syncSourceVisibilityInTx({
      tx,
      sourceType: ForumHashtagReferenceSourceTypeEnum.TOPIC,
      sourceId: topic.id,
      sourceAuditStatus: auditStatus,
      sourceIsHidden: topic.isHidden,
      isSourceVisible: this.isTopicVisible({
        auditStatus,
        isHidden: topic.isHidden,
        deletedAt: null,
      }),
    })
    await this.forumHashtagReferenceService.syncCommentVisibilityByTopicInTx(
      tx,
      topic.id,
      this.isTopicVisible({
        auditStatus,
        isHidden: topic.isHidden,
        deletedAt: null,
      }),
    )
    await this.syncTopicMentionVisibilityTransitionInTx(tx, {
      topicId: topic.id,
      actorUserId: topic.userId,
      topicTitle: topic.title,
      currentAuditStatus: topic.auditStatus,
      currentIsHidden: topic.isHidden,
      nextAuditStatus: auditStatus,
      nextIsHidden: topic.isHidden,
    })
    return topic
  }

  // 对外暴露审核通过奖励补发能力，供治理批量流程复用。
  async rewardApprovedTopicIfNeeded(params: ApprovedTopicRewardParams) {
    await this.dispatchApprovedTopicRewardIfNeeded(params)
  }

  // 用户编辑自己的主题；会校验作者身份。
  async updateUserTopic(
    userId: number,
    input: UpdateForumTopicDto,
    context: ForumTopicClientContext = {},
  ) {
    const topic = await this.getActiveTopicOrThrow(input.id)
    if (topic.userId !== userId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '无权修改该主题',
      )
    }
    return this.updateTopicWithCurrent(topic, input, context, userId)
  }

  // 用户删除自己的主题；会校验作者身份。
  async deleteUserTopic(
    userId: number,
    id: number,
    context: ForumTopicClientContext = {},
  ) {
    const topic = await this.getActiveTopicOrThrow(id)
    if (topic.userId !== userId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '无权删除该主题',
      )
    }
    return this.deleteTopicWithCurrent(topic, context, userId)
  }
}
