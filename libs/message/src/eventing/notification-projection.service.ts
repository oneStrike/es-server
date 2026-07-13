import type { DbTransaction } from '@db/core'
import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing/domain-event.type'
import type { MessageNotificationCategoryKey } from '../notification/notification.type'
import type {
  NotificationProjectionApplyResult,
  NotificationProjectionCommand,
} from './message-event.type'
import {
  acquireIntegrityLocks,
  DrizzleService,
  tableIntegrityLock,
} from '@db/core'
import { TaskTypeEnum } from '@libs/growth/task/task.constant'
import { EnablePlatformEnum, WorkTypeEnum } from '@libs/platform/constant'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { MessageInboxService } from '../inbox/inbox.service'
import { MessageNotificationPreferenceService } from '../notification/notification-preference.service'
import { MessageNotificationTemplateService } from '../notification/notification-template.service'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toPositiveInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }
  return undefined
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined
  }
  return value
}

function toNotificationKind<K extends string>(
  value: unknown,
  expected: K,
): K | undefined {
  return value === expected ? expected : undefined
}

function toWorkType(value: unknown): WorkTypeEnum | undefined {
  const normalized = toPositiveInteger(value)
  if (normalized === WorkTypeEnum.COMIC || normalized === WorkTypeEnum.NOVEL) {
    return normalized
  }
  return undefined
}

function toTaskType(value: unknown): TaskTypeEnum | undefined {
  const normalized = toPositiveInteger(value)
  if (
    normalized === TaskTypeEnum.ONBOARDING ||
    normalized === TaskTypeEnum.DAILY ||
    normalized === TaskTypeEnum.CAMPAIGN
  ) {
    return normalized
  }
  return undefined
}

/**
 * 通知投影服务。
 * 负责将 notification command 物化为 user_notification 读模型，并返回后续实时同步所需的最小结果。
 */
@Injectable()
export class NotificationProjectionService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly messageNotificationPreferenceService: MessageNotificationPreferenceService,
    private readonly messageNotificationTemplateService: MessageNotificationTemplateService,
    private readonly messageInboxService: MessageInboxService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get notification() {
    return this.drizzle.schema.userNotification
  }

  private get notificationDelivery() {
    return this.drizzle.schema.notificationDelivery
  }

  async applyCommand(
    command: NotificationProjectionCommand,
    _event: DomainEventRecord,
    _dispatch: DomainEventDispatchRecord,
  ): Promise<NotificationProjectionApplyResult> {
    if (command.mode === 'skip') {
      return {
        action: 'skip',
        reason: command.reason,
      }
    }

    if (command.mode === 'delete') {
      if (
        command.categoryKey === 'system_announcement' &&
        command.announcementId !== undefined &&
        (await this.isCurrentSystemAnnouncementVisible(command.announcementId))
      ) {
        return {
          action: 'skip',
          reason: 'stale_system_announcement_delete',
        }
      }

      const deleted = await this.deleteNotificationProjection(
        command.receiverUserId,
        command.projectionKey,
      )
      return {
        action: 'delete',
        receiverUserId: command.receiverUserId,
        projectionKey: command.projectionKey,
        notification: deleted,
      }
    }

    if (!command.mandatory) {
      const preference =
        await this.messageNotificationPreferenceService.getEffectiveNotificationPreference(
          command.receiverUserId,
          command.categoryKey,
        )
      if (!preference.isEnabled) {
        return {
          action: 'skip',
          reason: 'preference_disabled',
        }
      }
    }

    let normalizedPayload = await this.normalizeNotificationPayload(
      command.categoryKey,
      command.payload,
    )
    const notificationFacts = this.extractNotificationFacts(
      command.categoryKey,
      normalizedPayload,
    )
    this.assertRequiredNotificationFacts(command.categoryKey, notificationFacts)
    const systemAnnouncementProjection =
      command.categoryKey === 'system_announcement'
        ? await this.loadCurrentSystemAnnouncementProjection(
            notificationFacts.announcementId!,
          )
        : undefined
    if (
      command.categoryKey === 'system_announcement' &&
      !systemAnnouncementProjection
    ) {
      return {
        action: 'skip',
        reason: 'stale_system_announcement_publish',
      }
    }
    if (systemAnnouncementProjection) {
      normalizedPayload = systemAnnouncementProjection.payload
    }
    const rendered =
      await this.messageNotificationTemplateService.renderNotificationTemplate({
        categoryKey: command.categoryKey,
        receiverUserId: command.receiverUserId,
        actorUserId: command.actorUserId,
        title: systemAnnouncementProjection?.title ?? command.title,
        content: systemAnnouncementProjection?.content ?? command.content,
        data: normalizedPayload,
        expiresAt: command.expiresAt,
      })

    if (command.mode === 'append') {
      const insertedRows = await this.db
        .insert(this.notification)
        .values({
          categoryKey: command.categoryKey,
          projectionKey: command.projectionKey,
          receiverUserId: command.receiverUserId,
          actorUserId: command.actorUserId,
          title: rendered.title,
          content: rendered.content,
          payload: normalizedPayload,
          announcementId: notificationFacts.announcementId,
          expiresAt: command.expiresAt,
        })
        .onConflictDoNothing({
          target: [
            this.notification.receiverUserId,
            this.notification.projectionKey,
          ],
        })
        .returning()

      const inserted = insertedRows[0]
      if (inserted) {
        return {
          action: 'append',
          receiverUserId: command.receiverUserId,
          projectionKey: command.projectionKey,
          notification: inserted,
          actor: rendered.actor,
          templateId: rendered.templateId,
          usedTemplate: rendered.usedTemplate,
          fallbackReason: rendered.fallbackReason,
        }
      }

      const existing = await this.db.query.userNotification.findFirst({
        where: {
          receiverUserId: command.receiverUserId,
          projectionKey: command.projectionKey,
        },
        columns: {
          actorUserId: true,
          categoryKey: true,
          content: true,
          createdAt: true,
          expiresAt: true,
          id: true,
          isRead: true,
          payload: true,
          projectionKey: true,
          readAt: true,
          receiverUserId: true,
          title: true,
          updatedAt: true,
        },
      })
      if (!existing) {
        throw new Error('通知投影幂等命中后未找到既有通知')
      }

      return {
        action: 'append',
        receiverUserId: command.receiverUserId,
        projectionKey: command.projectionKey,
        notification: existing,
        actor: rendered.actor,
        templateId: undefined,
        usedTemplate: false,
        fallbackReason: 'idempotent_existing',
      }
    }

    const upsertedRows = await this.db
      .insert(this.notification)
      .values({
        categoryKey: command.categoryKey,
        projectionKey: command.projectionKey,
        receiverUserId: command.receiverUserId,
        actorUserId: command.actorUserId,
        title: rendered.title,
        content: rendered.content,
        payload: normalizedPayload,
        announcementId: notificationFacts.announcementId,
        expiresAt: command.expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          this.notification.receiverUserId,
          this.notification.projectionKey,
        ],
        set: {
          categoryKey: command.categoryKey,
          actorUserId: command.actorUserId,
          title: rendered.title,
          content: rendered.content,
          payload: normalizedPayload,
          announcementId: notificationFacts.announcementId,
          expiresAt: command.expiresAt,
        },
      })
      .returning()

    return {
      action: 'upsert',
      receiverUserId: command.receiverUserId,
      projectionKey: command.projectionKey,
      notification: upsertedRows[0],
      actor: rendered.actor,
      templateId: rendered.templateId,
      usedTemplate: rendered.usedTemplate,
      fallbackReason: rendered.fallbackReason,
    }
  }

  async getInboxSummary(userId: number) {
    return this.messageInboxService.getSummary(userId)
  }

  async getNotificationInboxSummary(userId: number) {
    return this.messageInboxService.getNotificationSummary(userId)
  }

  buildActiveNotificationWhere(receiverUserId: number, now = new Date()) {
    return and(
      eq(this.notification.receiverUserId, receiverUserId),
      or(
        isNull(this.notification.expiresAt),
        gt(this.notification.expiresAt, now),
      ),
    )
  }

  /**
   * 删除可见通知时，先与投递记录写入共享父通知的记录锁。
   * 在同一事务内清空历史投递引用，保留投递审计而不留下悬挂 notificationId。
   */
  private async deleteNotificationProjection(
    receiverUserId: number,
    projectionKey: string,
  ) {
    return this.drizzle.withTransaction({
      execute: async (tx) =>
        this.deleteNotificationProjectionInTransaction(
          tx,
          receiverUserId,
          projectionKey,
        ),
    })
  }

  private async deleteNotificationProjectionInTransaction(
    tx: DbTransaction,
    receiverUserId: number,
    projectionKey: string,
  ) {
    const located = await this.findNotificationProjectionInTransaction(
      tx,
      receiverUserId,
      projectionKey,
    )
    if (!located) {
      return undefined
    }

    await acquireIntegrityLocks(tx, [
      tableIntegrityLock('user_notification', located.id),
    ])

    const current = await this.findNotificationProjectionInTransaction(
      tx,
      receiverUserId,
      projectionKey,
    )
    if (!current || current.id !== located.id) {
      return undefined
    }

    await tx
      .update(this.notificationDelivery)
      .set({ notificationId: null })
      .where(eq(this.notificationDelivery.notificationId, current.id))

    const [deleted] = await tx
      .delete(this.notification)
      .where(eq(this.notification.id, current.id))
      .returning({
        id: this.notification.id,
        receiverUserId: this.notification.receiverUserId,
        projectionKey: this.notification.projectionKey,
      })

    return deleted
  }

  private async findNotificationProjectionInTransaction(
    tx: DbTransaction,
    receiverUserId: number,
    projectionKey: string,
  ) {
    const [notification] = await tx
      .select({ id: this.notification.id })
      .from(this.notification)
      .where(
        and(
          eq(this.notification.receiverUserId, receiverUserId),
          eq(this.notification.projectionKey, projectionKey),
        ),
      )
      .limit(1)

    return notification
  }

  private async normalizeNotificationPayload(
    categoryKey: MessageNotificationCategoryKey,
    payload?: Record<string, unknown> | null,
  ) {
    if (payload === null || payload === undefined) {
      return null
    }
    if (!isPlainRecord(payload)) {
      return null
    }
    if (categoryKey === 'task_reminder') {
      return this.normalizeTaskReminderPayload(payload)
    }
    if (
      categoryKey === 'comment_reply' ||
      categoryKey === 'comment_mention' ||
      categoryKey === 'comment_like'
    ) {
      return this.normalizeCommentActionPayload(categoryKey, payload)
    }
    if (
      categoryKey === 'topic_like' ||
      categoryKey === 'topic_favorited' ||
      categoryKey === 'topic_mentioned'
    ) {
      return this.normalizeTopicObjectPayload(payload)
    }
    if (categoryKey === 'topic_commented') {
      return this.normalizeTopicCommentedPayload(payload)
    }
    return payload
  }

  private normalizeTaskReminderPayload(payload: Record<string, unknown>) {
    const object = isPlainRecord(payload.object)
      ? this.normalizeTaskObject(payload.object)
      : undefined
    const reminder = isPlainRecord(payload.reminder)
      ? this.normalizeTaskReminderInfo(payload.reminder)
      : undefined
    if (!object || !reminder) {
      return null
    }

    return {
      object,
      reminder,
      reward: isPlainRecord(payload.reward)
        ? this.normalizeTaskReward(payload.reward)
        : null,
    }
  }

  private extractNotificationFacts(
    categoryKey: MessageNotificationCategoryKey,
    payload: Record<string, unknown> | null,
  ) {
    if (
      categoryKey === 'system_announcement' &&
      payload &&
      isPlainRecord(payload.object)
    ) {
      return {
        announcementId: toPositiveInteger(payload.object.id),
      }
    }

    return {
      announcementId: undefined,
    }
  }

  private assertRequiredNotificationFacts(
    categoryKey: MessageNotificationCategoryKey,
    facts: {
      announcementId?: number
    },
  ) {
    if (
      categoryKey === 'system_announcement' &&
      typeof facts.announcementId !== 'number'
    ) {
      throw new Error(
        'system_announcement notification must provide payload.object.id for typed announcement lookup',
      )
    }
  }

  private async loadCurrentSystemAnnouncementProjection(
    announcementId: number,
  ) {
    const announcement = await this.db.query.appAnnouncement.findFirst({
      where: { id: announcementId },
      columns: {
        id: true,
        announcementType: true,
        content: true,
        enablePlatform: true,
        isPublished: true,
        isRealtime: true,
        priorityLevel: true,
        publishEndTime: true,
        publishStartTime: true,
        summary: true,
        title: true,
      },
    })

    if (!announcement || !this.isSystemAnnouncementVisible(announcement)) {
      return null
    }

    const content =
      announcement.summary?.trim() ||
      announcement.content?.trim() ||
      '你收到一条新的系统公告。'

    return {
      content: content.slice(0, 180),
      payload: {
        object: {
          announcementType: announcement.announcementType,
          id: announcement.id,
          kind: 'announcement',
          priorityLevel: announcement.priorityLevel,
          summary: announcement.summary ?? null,
          title: announcement.title,
        },
      },
      title: announcement.title,
    }
  }

  private async isCurrentSystemAnnouncementVisible(announcementId: number) {
    const announcement = await this.db.query.appAnnouncement.findFirst({
      where: { id: announcementId },
      columns: {
        enablePlatform: true,
        isPublished: true,
        isRealtime: true,
        publishEndTime: true,
        publishStartTime: true,
      },
    })

    return !!announcement && this.isSystemAnnouncementVisible(announcement)
  }

  private isSystemAnnouncementVisible(input: {
    enablePlatform?: number[] | null
    isPublished: boolean
    isRealtime: boolean
    publishEndTime?: Date | null
    publishStartTime?: Date | null
  }) {
    const now = new Date()
    if (!input.isRealtime || !input.isPublished) {
      return false
    }
    if (!input.enablePlatform?.includes(EnablePlatformEnum.APP)) {
      return false
    }
    if (input.publishStartTime && input.publishStartTime > now) {
      return false
    }
    if (input.publishEndTime && input.publishEndTime <= now) {
      return false
    }
    return true
  }

  private async normalizeCommentActionPayload(
    categoryKey: MessageNotificationCategoryKey,
    payload: Record<string, unknown>,
  ) {
    const object = isPlainRecord(payload.object) ? payload.object : undefined
    const container = isPlainRecord(payload.container)
      ? payload.container
      : undefined
    const currentParentComment =
      categoryKey === 'comment_reply' && isPlainRecord(payload.parentComment)
        ? payload.parentComment
        : undefined
    const currentParentContainer = isPlainRecord(payload.parentContainer)
      ? payload.parentContainer
      : undefined

    if (!object || !container) {
      return null
    }

    const normalizedObject = await this.normalizeCommentObject(object)
    const normalizedParentComment = currentParentComment
      ? await this.normalizeCommentObject(currentParentComment)
      : undefined
    const normalizedContainer = await this.normalizeCommentContainer(
      container,
      currentParentContainer,
    )
    if (!normalizedObject || !normalizedContainer.container) {
      return null
    }

    return {
      object: normalizedObject,
      parentComment: normalizedParentComment ?? null,
      container: normalizedContainer.container,
      parentContainer: normalizedContainer.parentContainer ?? null,
    }
  }

  private async normalizeTopicObjectPayload(payload: Record<string, unknown>) {
    const object = isPlainRecord(payload.object) ? payload.object : undefined
    if (!object) {
      return null
    }
    const normalizedObject = await this.normalizeTopicContainer(
      toPositiveInteger(object.id) ?? 0,
      object,
    )
    if (!normalizedObject) {
      return null
    }

    return {
      object: normalizedObject,
    }
  }

  private async normalizeTopicCommentedPayload(
    payload: Record<string, unknown>,
  ) {
    const object = isPlainRecord(payload.object) ? payload.object : undefined
    const container = isPlainRecord(payload.container)
      ? payload.container
      : undefined
    if (!object || !container) {
      return null
    }
    const normalizedObject = await this.normalizeCommentObject(object)
    const normalizedContainer = await this.normalizeTopicContainer(
      toPositiveInteger(container.id) ?? 0,
      container,
    )
    if (!normalizedObject || !normalizedContainer) {
      return null
    }

    return {
      object: normalizedObject,
      container: normalizedContainer,
    }
  }

  private async normalizeCommentObject(object: Record<string, unknown>) {
    if (object.kind !== 'comment') {
      return null
    }

    const commentId = toPositiveInteger(object.id)
    if (!commentId) {
      return null
    }

    const commentRecord =
      toNonEmptyString(object.snippet) === undefined
        ? await this.db.query.userComment.findFirst({
            where: {
              id: commentId,
              deletedAt: { isNull: true },
            },
            columns: {
              content: true,
            },
          })
        : undefined

    return {
      kind: 'comment',
      id: commentId,
      snippet:
        toNonEmptyString(object.snippet) ??
        toNonEmptyString(commentRecord?.content) ??
        null,
    }
  }

  private async normalizeCommentContainer(
    container: Record<string, unknown>,
    parentContainer?: Record<string, unknown>,
  ): Promise<{
    container: Record<string, unknown> | null
    parentContainer?: Record<string, unknown>
  }> {
    const containerId = toPositiveInteger(container.id)
    if (!containerId || typeof container.kind !== 'string') {
      return {
        container: null,
      }
    }

    if (container.kind === 'work') {
      return {
        container: await this.normalizeWorkContainer(containerId, container),
        parentContainer,
      }
    }
    if (container.kind === 'topic') {
      return {
        container: await this.normalizeTopicContainer(containerId, container),
        parentContainer,
      }
    }
    if (container.kind === 'chapter') {
      return this.normalizeChapterContainer(
        containerId,
        container,
        parentContainer,
      )
    }

    return {
      container: null,
    }
  }

  private async normalizeWorkContainer(
    workId: number,
    current: Record<string, unknown>,
  ) {
    const work = await this.db.query.work.findFirst({
      where: {
        id: workId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        name: true,
        cover: true,
        type: true,
      },
    })

    return {
      kind: 'work',
      id: workId,
      title:
        toNonEmptyString(work?.name) ?? toNonEmptyString(current.title) ?? null,
      cover:
        toNonEmptyString(work?.cover) ??
        toNonEmptyString(current.cover) ??
        null,
      workType: toWorkType(work?.type) ?? toWorkType(current.workType) ?? null,
    }
  }

  private async normalizeTopicContainer(
    topicId: number,
    current: Record<string, unknown>,
  ) {
    if (!topicId) {
      return null
    }

    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id: topicId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        title: true,
        sectionId: true,
      },
    })

    return {
      kind: 'topic',
      id: topicId,
      title:
        toNonEmptyString(topic?.title) ??
        toNonEmptyString(current.title) ??
        null,
      sectionId:
        toPositiveInteger(topic?.sectionId) ??
        toPositiveInteger(current.sectionId) ??
        null,
    }
  }

  private async normalizeChapterContainer(
    chapterId: number,
    current: Record<string, unknown>,
    parentContainer?: Record<string, unknown>,
  ) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: {
        id: chapterId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        title: true,
        subtitle: true,
        cover: true,
        workId: true,
        workType: true,
      },
      with: {
        work: {
          columns: {
            id: true,
            name: true,
            cover: true,
            type: true,
          },
        },
      },
    })

    const resolvedParentContainer =
      chapter?.workId || toPositiveInteger(parentContainer?.id)
        ? {
            kind: 'work',
            id: chapter?.workId ?? toPositiveInteger(parentContainer?.id),
            title:
              toNonEmptyString(chapter?.work?.name) ??
              toNonEmptyString(parentContainer?.title) ??
              null,
            cover:
              toNonEmptyString(chapter?.work?.cover) ??
              toNonEmptyString(parentContainer?.cover) ??
              null,
            workType:
              toWorkType(chapter?.work?.type) ??
              toWorkType(parentContainer?.workType) ??
              null,
          }
        : undefined

    return {
      container: {
        kind: 'chapter',
        id: chapterId,
        title:
          toNonEmptyString(chapter?.title) ??
          toNonEmptyString(current.title) ??
          null,
        subtitle:
          toNonEmptyString(chapter?.subtitle) ??
          toNonEmptyString(current.subtitle) ??
          null,
        cover:
          toNonEmptyString(chapter?.cover) ??
          toNonEmptyString(chapter?.work?.cover) ??
          toNonEmptyString(current.cover) ??
          null,
        workId:
          toPositiveInteger(chapter?.workId) ??
          toPositiveInteger(current.workId) ??
          null,
        workType:
          toWorkType(chapter?.workType) ?? toWorkType(current.workType) ?? null,
      },
      parentContainer:
        resolvedParentContainer &&
        typeof resolvedParentContainer.id === 'number'
          ? resolvedParentContainer
          : parentContainer,
    }
  }

  private normalizeTaskObject(object: Record<string, unknown>) {
    if (object.kind !== 'task') {
      return null
    }
    const taskId = toPositiveInteger(object.id)
    const taskType = toTaskType(object.type)
    if (!taskId || !taskType) {
      return null
    }

    return {
      kind: 'task',
      id: taskId,
      code: toNonEmptyString(object.code) ?? `task-${taskId}`,
      cover: toNonEmptyString(object.cover) ?? null,
      title: toNonEmptyString(object.title) ?? '',
      type: taskType,
    }
  }

  private normalizeTaskReminderInfo(reminder: Record<string, unknown>) {
    const kind =
      toNotificationKind(reminder.kind, 'auto_assigned') ??
      toNotificationKind(reminder.kind, 'expiring_soon') ??
      toNotificationKind(reminder.kind, 'reward_granted')
    if (!kind) {
      return null
    }

    return {
      kind,
      cycleKey: toNonEmptyString(reminder.cycleKey) ?? null,
      expiredAt: reminder.expiredAt instanceof Date ? reminder.expiredAt : null,
      instanceId: toPositiveInteger(reminder.instanceId) ?? null,
    }
  }

  private normalizeTaskReward(reward: Record<string, unknown>) {
    const rawItems = Array.isArray(reward.items) ? reward.items : []
    const items = rawItems.flatMap((item) => {
      if (!isPlainRecord(item)) {
        return []
      }
      const assetType = toPositiveInteger(item.assetType)
      const amount = toPositiveInteger(item.amount)
      return assetType && amount ? [{ assetType, amount }] : []
    })
    const rawLedgerRecordIds = Array.isArray(reward.ledgerRecordIds)
      ? reward.ledgerRecordIds
      : []
    const ledgerRecordIds = rawLedgerRecordIds.flatMap((item) => {
      const id = toPositiveInteger(item)
      return id ? [id] : []
    })

    return {
      items,
      ledgerRecordIds,
    }
  }
}
