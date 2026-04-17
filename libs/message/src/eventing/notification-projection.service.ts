import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing'
import type {
  NotificationProjectionApplyResult,
  NotificationProjectionCommand,
} from './message-event.type'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { MessageInboxService } from '../inbox/inbox.service'
import { MessageNotificationPreferenceService } from '../notification/notification-preference.service'
import { MessageNotificationSubjectPayloadService } from '../notification/notification-subject-payload.service'
import { MessageNotificationTemplateService } from '../notification/notification-template.service'

/**
 * 通知投影服务。
 * 负责将 notification command 物化为 user_notification 读模型，并返回后续实时同步所需的最小结果。
 */
@Injectable()
export class NotificationProjectionService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly messageNotificationPreferenceService: MessageNotificationPreferenceService,
    private readonly messageNotificationSubjectPayloadService: MessageNotificationSubjectPayloadService,
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

    const normalizedPayload =
      await this.messageNotificationSubjectPayloadService.normalizePayload(
        command.categoryKey,
        command.payload,
      )
    const rendered =
      await this.messageNotificationTemplateService.renderNotificationTemplate({
        categoryKey: command.categoryKey,
        receiverUserId: command.receiverUserId,
        actorUserId: command.actorUserId,
        title: command.title,
        content: command.content,
        payload: normalizedPayload,
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
          expiresAt: command.expiresAt,
        },
      })
      .returning()

    return {
      action: 'upsert',
      receiverUserId: command.receiverUserId,
      projectionKey: command.projectionKey,
      notification: upsertedRows[0],
      templateId: rendered.templateId,
      usedTemplate: rendered.usedTemplate,
      fallbackReason: rendered.fallbackReason,
    }
  }

  async getInboxSummary(userId: number) {
    return this.messageInboxService.getSummary(userId)
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
}
