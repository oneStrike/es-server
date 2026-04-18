import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing'
import type { MessageNotificationCategoryKey } from '../notification/notification.constant'
import type {
  NotificationProjectionApplyResult,
  NotificationProjectionCommand,
} from './message-event.type'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { MessageInboxService } from '../inbox/inbox.service'
import { MessageNotificationPreferenceService } from '../notification/notification-preference.service'
import { MessageNotificationTemplateService } from '../notification/notification-template.service'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toPositiveInteger(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }
  return undefined
}

function toNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined
}

function firstNonEmptyString(values: unknown) {
  if (!Array.isArray(values)) {
    return undefined
  }
  return values.find((value) => typeof value === 'string' && value.trim()) as
    | string
    | undefined
}

function compactRecord<T extends Record<string, unknown>>(value: T) {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined)
  return Object.fromEntries(entries) as T
}

function extractPositiveInteger<T>(value: T) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined
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
      const deletedRows = await this.db
        .delete(this.notification)
        .where(
          and(
            eq(this.notification.receiverUserId, command.receiverUserId),
            eq(this.notification.projectionKey, command.projectionKey),
          ),
        )
        .returning({
          id: this.notification.id,
          receiverUserId: this.notification.receiverUserId,
          projectionKey: this.notification.projectionKey,
        })

      const deleted = deletedRows[0]
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

    const normalizedPayload = await this.normalizeNotificationPayload(
      command.categoryKey,
      command.payload,
    )
    const notificationFacts = this.extractNotificationFacts(
      command.categoryKey,
      normalizedPayload,
    )
    this.assertRequiredNotificationFacts(command.categoryKey, notificationFacts)
    const rendered =
      await this.messageNotificationTemplateService.renderNotificationTemplate({
        categoryKey: command.categoryKey,
        receiverUserId: command.receiverUserId,
        actorUserId: command.actorUserId,
        title: command.title,
        content: command.content,
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
      return this.normalizeCommentActionPayload(payload)
    }
    return payload
  }

  private normalizeTaskReminderPayload(payload: Record<string, unknown>) {
    const normalized = compactRecord({
      object: isPlainRecord(payload.object) ? payload.object : undefined,
      reminder: isPlainRecord(payload.reminder) ? payload.reminder : undefined,
      reward: isPlainRecord(payload.reward) ? payload.reward : undefined,
    })

    return Object.keys(normalized).length > 0 ? normalized : null
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
        announcementId: extractPositiveInteger(payload.object.id),
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

  private async normalizeCommentActionPayload(
    payload: Record<string, unknown>,
  ) {
    const object = isPlainRecord(payload.object) ? payload.object : undefined
    const container = isPlainRecord(payload.container)
      ? payload.container
      : undefined
    const currentParentContainer = isPlainRecord(payload.parentContainer)
      ? payload.parentContainer
      : undefined

    if (!object || !container) {
      return payload
    }

    const normalizedObject = await this.normalizeCommentObject(object)
    const normalizedContainer = await this.normalizeCommentContainer(
      container,
      currentParentContainer,
    )

    return compactRecord({
      object: normalizedObject,
      container: normalizedContainer.container,
      parentContainer:
        normalizedContainer.parentContainer ?? currentParentContainer,
    })
  }

  private async normalizeCommentObject(object: Record<string, unknown>) {
    if (object.kind !== 'comment') {
      return object
    }

    const commentId = toPositiveInteger(object.id)
    if (!commentId) {
      return object
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

    return compactRecord({
      kind: 'comment',
      id: commentId,
      snippet:
        toNonEmptyString(object.snippet) ??
        toNonEmptyString(commentRecord?.content) ??
        undefined,
    })
  }

  private async normalizeCommentContainer(
    container: Record<string, unknown>,
    parentContainer?: Record<string, unknown>,
  ): Promise<{
    container: Record<string, unknown>
    parentContainer?: Record<string, unknown>
  }> {
    const containerId = toPositiveInteger(container.id)
    if (!containerId || typeof container.kind !== 'string') {
      return {
        container,
        parentContainer,
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
      container,
      parentContainer,
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

    return compactRecord({
      kind: 'work',
      id: workId,
      title: toNonEmptyString(work?.name) ?? toNonEmptyString(current.title),
      cover: toNonEmptyString(work?.cover) ?? toNonEmptyString(current.cover),
      workType:
        toPositiveInteger(work?.type) ?? toPositiveInteger(current.workType),
    })
  }

  private async normalizeTopicContainer(
    topicId: number,
    current: Record<string, unknown>,
  ) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id: topicId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        title: true,
        sectionId: true,
        images: true,
      },
    })

    return compactRecord({
      kind: 'topic',
      id: topicId,
      title: toNonEmptyString(topic?.title) ?? toNonEmptyString(current.title),
      cover:
        firstNonEmptyString(topic?.images) ?? toNonEmptyString(current.cover),
      sectionId:
        toPositiveInteger(topic?.sectionId) ??
        toPositiveInteger(current.sectionId),
    })
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
        ? compactRecord({
            kind: 'work',
            id: chapter?.workId ?? toPositiveInteger(parentContainer?.id),
            title:
              toNonEmptyString(chapter?.work?.name) ??
              toNonEmptyString(parentContainer?.title),
            cover:
              toNonEmptyString(chapter?.work?.cover) ??
              toNonEmptyString(parentContainer?.cover),
            workType:
              toPositiveInteger(chapter?.work?.type) ??
              toPositiveInteger(parentContainer?.workType),
          })
        : undefined

    return {
      container: compactRecord({
        kind: 'chapter',
        id: chapterId,
        title:
          toNonEmptyString(chapter?.title) ?? toNonEmptyString(current.title),
        subtitle:
          toNonEmptyString(chapter?.subtitle) ??
          toNonEmptyString(current.subtitle),
        cover:
          toNonEmptyString(chapter?.cover) ??
          toNonEmptyString(chapter?.work?.cover) ??
          toNonEmptyString(current.cover),
        workId:
          toPositiveInteger(chapter?.workId) ??
          toPositiveInteger(current.workId),
        workType:
          toPositiveInteger(chapter?.workType) ??
          toPositiveInteger(current.workType),
      }),
      parentContainer:
        resolvedParentContainer &&
        typeof resolvedParentContainer.id === 'number'
          ? resolvedParentContainer
          : parentContainer,
    }
  }
}
