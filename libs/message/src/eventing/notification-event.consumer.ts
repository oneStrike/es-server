import type { UserNotificationSelect } from '@db/schema'
import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing/domain-event.type'
import type { NotificationActorSource } from '../notification/notification-public.mapper'
import type { NotificationEventHandler } from './message-event.type'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { MessageNotificationDeliveryService } from '../notification/notification-delivery.service'
import { mapUserNotificationToPublicView } from '../notification/notification-public.mapper'
import { MessageNotificationRealtimeService } from '../notification/notification-realtime.service'
import { getMessageDomainEventDefinition } from './message-event.constant'
import { NotificationProjectionService } from './notification-projection.service'

export function getNotificationEventPayload(
  event: DomainEventRecord,
): Record<string, unknown> | null {
  const payload = event.context?.payload
  if (payload === undefined) {
    return {
      eventKey: event.eventKey,
    }
  }
  if (payload === null) {
    return null
  }
  if (typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>
  }
  return {
    eventKey: event.eventKey,
  }
}

function getNotificationExpiresAt(event: DomainEventRecord): Date | undefined {
  if (!event.context?.expiresAt) {
    return undefined
  }
  const expiresAt = new Date(String(event.context.expiresAt))
  if (Number.isNaN(expiresAt.getTime())) {
    throw new TypeError(
      'notification event context.expiresAt must be a valid date',
    )
  }
  return expiresAt
}

function requireNotificationContextPositiveInteger(
  event: DomainEventRecord,
  fieldName: 'receiverUserId',
) {
  const value = event.context?.[fieldName]
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : Number.NaN

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new TypeError(
      `notification event context.${fieldName} must be a positive integer`,
    )
  }

  return numericValue
}

function requireNotificationContextNonEmptyString(
  event: DomainEventRecord,
  fieldName: 'content' | 'projectionKey' | 'title',
) {
  const value = event.context?.[fieldName]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(
      `notification event context.${fieldName} must be a non-empty string`,
    )
  }
  return value.trim()
}

function createNotificationEventHandler(
  mode: 'append' | 'upsert',
  includeExpiresAt = false,
): NotificationEventHandler {
  return ({ definition, event }) => {
    const command = {
      mode,
      receiverUserId: requireNotificationContextPositiveInteger(
        event,
        'receiverUserId',
      ),
      categoryKey: definition.notification!.categoryKey,
      projectionKey: requireNotificationContextNonEmptyString(
        event,
        'projectionKey',
      ),
      mandatory: definition.notification!.mandatory,
      actorUserId: event.operatorId ?? undefined,
      title: requireNotificationContextNonEmptyString(event, 'title'),
      content: requireNotificationContextNonEmptyString(event, 'content'),
      payload: getNotificationEventPayload(event),
    }

    if (!includeExpiresAt) {
      return command
    }

    return {
      ...command,
      expiresAt: getNotificationExpiresAt(event),
    }
  }
}

const appendNotificationEventHandler = createNotificationEventHandler('append')
const expiringAppendNotificationEventHandler = createNotificationEventHandler(
  'append',
  true,
)
const upsertNotificationEventHandler = createNotificationEventHandler('upsert')

const NOTIFICATION_EVENT_HANDLERS: Record<string, NotificationEventHandler> = {
  'comment.replied': appendNotificationEventHandler,
  'comment.mentioned': appendNotificationEventHandler,
  'comment.liked': appendNotificationEventHandler,
  'topic.liked': appendNotificationEventHandler,
  'topic.favorited': appendNotificationEventHandler,
  'topic.commented': appendNotificationEventHandler,
  'topic.mentioned': appendNotificationEventHandler,
  'user.followed': appendNotificationEventHandler,
  'announcement.published': upsertNotificationEventHandler,
  'announcement.unpublished': ({ event }) => ({
    mode: 'delete' as const,
    receiverUserId: requireNotificationContextPositiveInteger(
      event,
      'receiverUserId',
    ),
    projectionKey: requireNotificationContextNonEmptyString(
      event,
      'projectionKey',
    ),
  }),
  'task.reminder.auto_assigned': expiringAppendNotificationEventHandler,
  'task.reminder.expiring': expiringAppendNotificationEventHandler,
  'task.reminder.reward_granted': appendNotificationEventHandler,
}

/**
 * 通知事件 consumer。
 * 使用固定 handler map 生成投影命令，并驱动 notification projection、delivery 和实时同步。
 */
@Injectable()
export class NotificationEventConsumer {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly notificationProjectionService: NotificationProjectionService,
    private readonly messageNotificationDeliveryService: MessageNotificationDeliveryService,
    private readonly messageNotificationRealtimeService: MessageNotificationRealtimeService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  async consume(event: DomainEventRecord, dispatch: DomainEventDispatchRecord) {
    const definition = getMessageDomainEventDefinition(event.eventKey as never)
    const handler = NOTIFICATION_EVENT_HANDLERS[event.eventKey]
    if (!handler) {
      const result = await this.notificationProjectionService.applyCommand(
        {
          mode: 'skip',
          reason: `unsupported_notification_event:${event.eventKey}`,
        },
        event,
        dispatch,
      )
      await this.messageNotificationDeliveryService.recordHandledDispatch(
        event,
        dispatch,
        result,
      )
      return result
    }

    const command = await handler({
      definition,
      event,
      dispatch,
    })
    const result = await this.notificationProjectionService.applyCommand(
      command,
      event,
      dispatch,
    )

    if (result.action === 'append' && result.notification) {
      const publicNotification = await this.buildPublicNotificationView(
        result.notification,
        result.actor,
      )
      this.messageNotificationRealtimeService.emitNotificationCreated(
        result.receiverUserId!,
        publicNotification,
      )
    }
    if (result.action === 'upsert' && result.notification) {
      const publicNotification = await this.buildPublicNotificationView(
        result.notification,
        result.actor,
      )
      this.messageNotificationRealtimeService.emitNotificationUpdated(
        result.receiverUserId!,
        publicNotification,
      )
    }
    const deletedNotificationId = (
      result.notification as { id?: number } | undefined
    )?.id
    if (
      result.action === 'delete' &&
      result.receiverUserId &&
      typeof deletedNotificationId === 'number'
    ) {
      this.messageNotificationRealtimeService.emitNotificationDeleted(
        result.receiverUserId,
        {
          id: deletedNotificationId,
        },
      )
    }

    if (result.receiverUserId) {
      const summary =
        await this.notificationProjectionService.getNotificationInboxSummary(
          result.receiverUserId,
        )
      this.messageNotificationRealtimeService.emitInboxSummaryUpdated(
        result.receiverUserId,
        summary,
      )
    }

    await this.messageNotificationDeliveryService.recordHandledDispatch(
      event,
      dispatch,
      result,
    )

    return result
  }

  private async buildPublicNotificationView(
    notification: Record<string, unknown>,
    actorOverride?: NotificationActorSource,
  ) {
    const typedNotification = notification as UserNotificationSelect
    let actor: NotificationActorSource | undefined = actorOverride
    if (!actor && typeof typedNotification.actorUserId === 'number') {
      const actorRecord = await this.db.query.appUser.findFirst({
        where: {
          id: typedNotification.actorUserId,
        },
        columns: {
          id: true,
          nickname: true,
          avatarUrl: true,
        },
      })
      actor = actorRecord
    }

    return mapUserNotificationToPublicView(typedNotification, actor)
  }
}
