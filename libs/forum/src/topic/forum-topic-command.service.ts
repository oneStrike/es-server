import type { Db } from '@db/core'
import type { ForumTopicSelect } from '@db/schema'

import type { JsonValue } from '@libs/platform/utils'
import type {
  ApprovedTopicRewardParams,
  ForumTopicClientContext,
  TopicAuditActorOptions,
  TopicGovernanceSnapshot,
  UpdateTopicStatusData,
  UpdateTopicStatusOptions,
} from './forum-topic.type'
import { DrizzleService } from '@db/core'
import { EventDefinitionConsumerEnum } from '@libs/growth/event-definition/event-definition.constant'
import { canConsumeEventEnvelopeByConsumer } from '@libs/growth/event-definition/event-envelope.type'
import { GrowthBalanceQueryService } from '@libs/growth/growth-ledger/growth-balance-query.service'
import { GrowthEventBridgeService } from '@libs/growth/growth-reward/growth-event-bridge.service'
import { BodyCompilerService } from '@libs/interaction/body/body-compiler.service'
import { BodyHtmlCodecService } from '@libs/interaction/body/body-html-codec.service'
import { BODY_VERSION_V1 } from '@libs/interaction/body/body.constant'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { EmojiCatalogService } from '@libs/interaction/emoji/emoji-catalog.service'
import { EmojiSceneEnum } from '@libs/interaction/emoji/emoji.constant'
import { MentionSourceTypeEnum } from '@libs/interaction/mention/mention.constant'
import { MentionService } from '@libs/interaction/mention/mention.service'
import { InteractionSummaryReadService } from '@libs/interaction/summary/interaction-summary-read.service'
import { AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import { SensitiveWordStatisticsService } from '@libs/sensitive-word/sensitive-word-statistics.service'
import { AppUserCountService } from '@libs/user/app-user-count.service'
import { Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log/action-log.constant'
import { ForumUserActionLogService } from '../action-log/action-log.service'
import { ForumCounterService } from '../counter/forum-counter.service'
import { ForumHashtagBodyService } from '../hashtag/forum-hashtag-body.service'
import { ForumHashtagReferenceService } from '../hashtag/forum-hashtag-reference.service'
import { ForumHashtagReferenceSourceTypeEnum } from '../hashtag/forum-hashtag.constant'
import { ForumPermissionService } from '../permission/forum-permission.service'
import {
  CreateForumTopicDto,
  MoveForumTopicDto,
  UpdateForumTopicAuditStatusDto,
  UpdateForumTopicDto,
  UpdateForumTopicFeaturedDto,
  UpdateForumTopicHiddenDto,
  UpdateForumTopicLockedDto,
  UpdateForumTopicPinnedDto,
} from './dto/forum-topic.dto'
import { ForumTopicServiceSupport } from './forum-topic.service.support'

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
    const topic = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const compiledBody = await this.materializeTopicBodyInTx(
          tx,
          { html },
          userId,
        )
        await this.lockSectionForMutation(tx, sectionId)
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
        const title = this.resolveCreateTopicTitle(
          inputTitle,
          compiledBody.plainText,
        )
        const { hits, publicHits, highestLevel } =
          this.detectTopicSensitiveWords(title, compiledBody.plainText)
        const reviewPolicy = liveSection.topicReviewPolicy
        const { auditStatus, isHidden } = this.calculateAuditStatus(
          reviewPolicy,
          highestLevel,
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
          auditStatus,
          sensitiveWordHits: publicHits.length ? publicHits : undefined,
          isHidden,
        }
        const [newTopic] = await tx
          .insert(this.forumTopicTable)
          .values(createPayload)
          .returning()
        await this.sensitiveWordStatisticsService.recordEntityHitsInTx(tx, {
          entityType: 'topic',
          entityId: newTopic.id,
          operationType: 'create',
          hits,
          occurredAt: newTopic.createdAt,
        })
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
          sourceAuditStatus: newTopic.auditStatus as AuditStatusEnum,
          sourceIsHidden: newTopic.isHidden,
          isSourceVisible: this.isTopicVisible({
            auditStatus: newTopic.auditStatus as AuditStatusEnum,
            isHidden: newTopic.isHidden,
            deletedAt: newTopic.deletedAt,
          }),
          hashtagFacts: compiledBody.hashtagFacts,
        })
        await this.forumCounterService.updateUserForumTopicCount(tx, userId, 1)
        await this.forumCounterService.syncSectionVisibleState(tx, sectionId)
        if (
          this.isTopicVisible({
            auditStatus: newTopic.auditStatus as AuditStatusEnum,
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
      auditStatus: topic.auditStatus as AuditStatusEnum,
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
    topic: ForumTopicSelect,
    updateForumTopicDto: UpdateForumTopicDto,
    context: ForumTopicClientContext = {},
    actorUserId = topic.userId,
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
    const reviewPolicy = await this.getSectionTopicReviewPolicy(
      topic.sectionId,
      { notFoundMessage: '主题所属板块不存在' },
    )
    const media = this.normalizeTopicMedia(
      { images, videos },
      { images: topic.images, videos: topic.videos },
    )
    const updatedTopic = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const compiledBody = await this.materializeTopicBodyInTx(
          tx,
          { html },
          actorUserId,
        )
        const nextTitle = this.resolveUpdateTopicTitle(
          topic.title,
          nextTitleInput,
        )
        const nextContent = compiledBody.plainText
        const { hits, publicHits, highestLevel } =
          this.detectTopicSensitiveWords(nextTitle, nextContent)
        const { auditStatus, isHidden } = this.calculateAuditStatus(
          reviewPolicy,
          highestLevel,
        )
        const updatePayload = {
          title: nextTitle,
          html: compiledBody.html,
          content: compiledBody.plainText,
          body: compiledBody.body as unknown as JsonValue,
          contentPreview: compiledBody.contentPreview as unknown as JsonValue,
          ...media,
          bodyVersion: BODY_VERSION_V1,
          auditStatus,
          sensitiveWordHits: publicHits.length ? publicHits : null,
          isHidden,
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
          .returning()
        if (!nextTopic) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '主题不存在',
          )
        }
        await this.sensitiveWordStatisticsService.recordEntityHitsInTx(tx, {
          entityType: 'topic',
          entityId: nextTopic.id,
          operationType: 'update',
          hits,
          occurredAt: nextTopic.updatedAt ?? new Date(),
        })
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
          sectionId: topic.sectionId,
          userId: nextTopic.userId,
          sourceAuditStatus: nextTopic.auditStatus as AuditStatusEnum,
          sourceIsHidden: nextTopic.isHidden,
          isSourceVisible: this.isTopicVisible({
            auditStatus: nextTopic.auditStatus as AuditStatusEnum,
            isHidden: nextTopic.isHidden,
            deletedAt: nextTopic.deletedAt,
          }),
          hashtagFacts: compiledBody.hashtagFacts,
        })
        await this.forumCounterService.syncSectionVisibleState(
          tx,
          topic.sectionId,
        )
        await this.forumHashtagReferenceService.syncCommentVisibilityByTopicInTx(
          tx,
          nextTopic.id,
          this.isTopicVisible({
            auditStatus: nextTopic.auditStatus as AuditStatusEnum,
            isHidden: nextTopic.isHidden,
            deletedAt: nextTopic.deletedAt,
          }),
        )
        if (
          this.isTopicVisible({
            auditStatus: nextTopic.auditStatus as AuditStatusEnum,
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
        return nextTopic
      }),
    )
    await this.actionLogService.createActionLog({
      userId: topic.userId,
      actionType: ForumUserActionTypeEnum.UPDATE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: id,
      beforeData: JSON.stringify(topic),
      afterData: JSON.stringify(updatedTopic),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      geoCountry: context.geoCountry,
      geoProvince: context.geoProvince,
      geoCity: context.geoCity,
      geoIsp: context.geoIsp,
      geoSource: context.geoSource,
    })
    return true
  }

  // 管理端更新主题内容；默认以主题作者作为行为主体。
  async updateTopic(
    updateForumTopicDto: UpdateForumTopicDto,
    context: ForumTopicClientContext = {},
    actorUserId?: number,
  ) {
    const topic = await this.getActiveTopicOrThrow(updateForumTopicDto.id)
    return this.updateTopicWithCurrent(
      topic,
      updateForumTopicDto,
      context,
      actorUserId ?? topic.userId,
    )
  }

  // 基于当前主题快照删除主题，并在事务中同步评论、引用和计数。
  private async deleteTopicWithCurrent(
    topic: ForumTopicSelect,
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
    tx: Db,
    topic: ForumTopicSelect,
    context: ForumTopicClientContext = {},
    actorUserId = topic.userId,
  ) {
    const { id } = topic
    const commentUserSummaries = await tx
      .select({
        userId: this.userCommentTable.userId,
        commentCount: sql<number>`count(*)::int`,
        receivedLikeCount: sql<number>`coalesce(sum(${this.userCommentTable.likeCount}), 0)::int`,
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
      .set({ deletedAt: new Date() })
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
      .set({ deletedAt: new Date() })
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
      topic.userId,
      -1,
    )
    if (topic.likeCount > 0) {
      await this.forumCounterService.updateUserForumTopicReceivedLikeCount(
        tx,
        topic.userId,
        -topic.likeCount,
      )
    }
    if (topic.favoriteCount > 0) {
      await this.forumCounterService.updateUserForumTopicReceivedFavoriteCount(
        tx,
        topic.userId,
        -topic.favoriteCount,
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
    await this.forumCounterService.syncSectionVisibleState(tx, topic.sectionId)
    await this.actionLogService.createActionLogInTx(tx, {
      userId: actorUserId,
      actionType: ForumUserActionTypeEnum.DELETE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: topic.id,
      beforeData: JSON.stringify(topic),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      geoCountry: context.geoCountry,
      geoProvince: context.geoProvince,
      geoCity: context.geoCity,
      geoIsp: context.geoIsp,
      geoSource: context.geoSource,
    })
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

  // 移动主题到目标板块，并同步源板块与目标板块的可见计数。
  async moveTopic(input: MoveForumTopicDto) {
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
    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        await this.moveTopicInTx(tx, input, currentTopic.sectionId)
      }),
    )
    return true
  }

  // 在既有事务中移动主题；用于治理批量操作保持事务一致性。
  async moveTopicInTx(
    tx: Db,
    input: MoveForumTopicDto,
    currentSectionId?: number,
  ) {
    const sourceSectionId =
      currentSectionId ??
      (
        await tx.query.forumTopic.findFirst({
          where: { id: input.id, deletedAt: { isNull: true } },
          columns: { sectionId: true },
        })
      )?.sectionId
    if (!sourceSectionId) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }
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
    tx: Db,
    id: number,
    updateData: UpdateTopicStatusData,
    options?: UpdateTopicStatusOptions,
    sectionId?: number,
  ) {
    const currentSectionId =
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
    tx: Db,
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
    tx: Db,
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
    tx: Db,
    updateTopicLockedDto: UpdateForumTopicLockedDto,
  ) {
    return this.updateTopicStatusInTx(tx, updateTopicLockedDto.id, {
      isLocked: updateTopicLockedDto.isLocked,
    })
  }

  // 更新主题隐藏状态，并同步可见性相关引用与 mention。
  async updateTopicHidden(updateTopicHiddenDto: UpdateForumTopicHiddenDto) {
    const currentTopic = await this.db.query.forumTopic.findFirst({
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
    if (!currentTopic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }
    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) =>
        this.updateTopicHiddenInTx(tx, updateTopicHiddenDto, currentTopic),
      ),
    )
    return true
  }

  // 在既有事务中更新主题隐藏状态；供治理链路复用。
  async updateTopicHiddenInTx(
    tx: Db,
    updateTopicHiddenDto: UpdateForumTopicHiddenDto,
    currentTopic?: TopicGovernanceSnapshot,
  ) {
    const topic =
      currentTopic ??
      (await tx.query.forumTopic.findFirst({
        where: { id: updateTopicHiddenDto.id, deletedAt: { isNull: true } },
        columns: {
          id: true,
          sectionId: true,
          userId: true,
          title: true,
          auditStatus: true,
          isHidden: true,
        },
      }))
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
      sourceAuditStatus: topic.auditStatus as AuditStatusEnum,
      sourceIsHidden: updateTopicHiddenDto.isHidden,
      isSourceVisible: this.isTopicVisible({
        auditStatus: topic.auditStatus as AuditStatusEnum,
        isHidden: updateTopicHiddenDto.isHidden,
        deletedAt: null,
      }),
    })
    await this.forumHashtagReferenceService.syncCommentVisibilityByTopicInTx(
      tx,
      topic.id,
      this.isTopicVisible({
        auditStatus: topic.auditStatus as AuditStatusEnum,
        isHidden: updateTopicHiddenDto.isHidden,
        deletedAt: null,
      }),
    )
    await this.syncTopicMentionVisibilityTransitionInTx(tx, {
      topicId: topic.id,
      actorUserId: topic.userId,
      topicTitle: topic.title,
      currentAuditStatus: topic.auditStatus as AuditStatusEnum,
      currentIsHidden: topic.isHidden,
      nextAuditStatus: topic.auditStatus as AuditStatusEnum,
      nextIsHidden: updateTopicHiddenDto.isHidden,
    })
    return true
  }

  // 当主题从待审核变为已通过时补发创建主题奖励事件。
  private async dispatchApprovedTopicRewardIfNeeded(
    params: ApprovedTopicRewardParams,
  ) {
    if (
      params.previousAuditStatus !== AuditStatusEnum.PENDING ||
      params.nextAuditStatus !== AuditStatusEnum.APPROVED
    ) {
      return
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
      return
    }
    await this.growthEventBridgeService.dispatchDefinedEvent({
      eventEnvelope: topicApprovedEvent,
      bizKey: `forum:topic:create:${params.topicId}:user:${params.userId}`,
      source: 'forum_topic',
    })
  }

  // 更新主题审核状态，并在审核通过时补发成长奖励。
  async updateTopicAuditStatus(
    updateTopicAuditStatusDto: UpdateForumTopicAuditStatusDto,
    options?: TopicAuditActorOptions,
  ) {
    const { id, auditStatus } = updateTopicAuditStatusDto
    const currentTopic = await this.db.query.forumTopic.findFirst({
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
    if (!currentTopic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }
    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) =>
        this.updateTopicAuditStatusInTx(
          tx,
          updateTopicAuditStatusDto,
          options,
          currentTopic,
        ),
      ),
    )
    await this.dispatchApprovedTopicRewardIfNeeded({
      topicId: currentTopic.id,
      userId: currentTopic.userId,
      previousAuditStatus: currentTopic.auditStatus as AuditStatusEnum,
      nextAuditStatus: auditStatus,
    })
    return true
  }

  // 在既有事务中更新主题审核状态并同步可见性。
  async updateTopicAuditStatusInTx(
    tx: Db,
    updateTopicAuditStatusDto: UpdateForumTopicAuditStatusDto,
    options?: TopicAuditActorOptions,
    currentTopic?: TopicGovernanceSnapshot,
  ) {
    const { id, auditStatus, auditReason } = updateTopicAuditStatusDto
    const topic =
      currentTopic ??
      (await tx.query.forumTopic.findFirst({
        where: { id, deletedAt: { isNull: true } },
        columns: {
          id: true,
          sectionId: true,
          userId: true,
          title: true,
          auditStatus: true,
          isHidden: true,
        },
      }))
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
      currentAuditStatus: topic.auditStatus as AuditStatusEnum,
      currentIsHidden: topic.isHidden,
      nextAuditStatus: auditStatus,
      nextIsHidden: topic.isHidden,
    })
    return true
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
