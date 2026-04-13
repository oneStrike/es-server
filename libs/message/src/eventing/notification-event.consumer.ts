import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing'
import type {
  NotificationEventHandler,
  NotificationProjectionCommand,
} from './message-event.type'
import { Injectable } from '@nestjs/common'
import { MessageNotificationDeliveryService } from '../notification/notification-delivery.service'
import { MessageNotificationRealtimeService } from '../notification/notification-realtime.service'
import { getMessageDomainEventDefinition } from './message-event.constant'
import { NotificationProjectionService } from './notification-projection.service'

const NOTIFICATION_EVENT_HANDLERS: Record<string, NotificationEventHandler> = {
  'comment.replied': ({ definition, event }) => ({
    mode: 'append' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    categoryKey: definition.notification!.categoryKey,
    projectionKey: String(event.context?.projectionKey ?? ''),
    mandatory: definition.notification!.mandatory,
    actorUserId:
      event.operatorId === null || event.operatorId === undefined
        ? undefined
        : event.operatorId,
    title: String(event.context?.title ?? ''),
    content: String(event.context?.content ?? ''),
    payload: (event.context?.payload as
      | Record<string, unknown>
      | undefined) ?? {
      eventKey: event.eventKey,
    },
  }),
  'comment.mentioned': ({ definition, event }) => ({
    mode: 'append' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    categoryKey: definition.notification!.categoryKey,
    projectionKey: String(event.context?.projectionKey ?? ''),
    mandatory: definition.notification!.mandatory,
    actorUserId: event.operatorId ?? undefined,
    title: String(event.context?.title ?? ''),
    content: String(event.context?.content ?? ''),
    payload: (event.context?.payload as
      | Record<string, unknown>
      | undefined) ?? {
      eventKey: event.eventKey,
    },
  }),
  'comment.liked': ({ definition, event }) => ({
    mode: 'append' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    categoryKey: definition.notification!.categoryKey,
    projectionKey: String(event.context?.projectionKey ?? ''),
    mandatory: definition.notification!.mandatory,
    actorUserId: event.operatorId ?? undefined,
    title: String(event.context?.title ?? ''),
    content: String(event.context?.content ?? ''),
    payload: (event.context?.payload as
      | Record<string, unknown>
      | undefined) ?? {
      eventKey: event.eventKey,
    },
  }),
  'topic.liked': ({ definition, event }) => ({
    mode: 'append' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    categoryKey: definition.notification!.categoryKey,
    projectionKey: String(event.context?.projectionKey ?? ''),
    mandatory: definition.notification!.mandatory,
    actorUserId: event.operatorId ?? undefined,
    title: String(event.context?.title ?? ''),
    content: String(event.context?.content ?? ''),
    payload: (event.context?.payload as
      | Record<string, unknown>
      | undefined) ?? {
      eventKey: event.eventKey,
    },
  }),
  'topic.favorited': ({ definition, event }) => ({
    mode: 'append' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    categoryKey: definition.notification!.categoryKey,
    projectionKey: String(event.context?.projectionKey ?? ''),
    mandatory: definition.notification!.mandatory,
    actorUserId: event.operatorId ?? undefined,
    title: String(event.context?.title ?? ''),
    content: String(event.context?.content ?? ''),
    payload: (event.context?.payload as
      | Record<string, unknown>
      | undefined) ?? {
      eventKey: event.eventKey,
    },
  }),
  'topic.commented': ({ definition, event }) => ({
    mode: 'append' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    categoryKey: definition.notification!.categoryKey,
    projectionKey: String(event.context?.projectionKey ?? ''),
    mandatory: definition.notification!.mandatory,
    actorUserId: event.operatorId ?? undefined,
    title: String(event.context?.title ?? ''),
    content: String(event.context?.content ?? ''),
    payload: (event.context?.payload as
      | Record<string, unknown>
      | undefined) ?? {
      eventKey: event.eventKey,
    },
  }),
  'topic.mentioned': ({ definition, event }) => ({
    mode: 'append' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    categoryKey: definition.notification!.categoryKey,
    projectionKey: String(event.context?.projectionKey ?? ''),
    mandatory: definition.notification!.mandatory,
    actorUserId: event.operatorId ?? undefined,
    title: String(event.context?.title ?? ''),
    content: String(event.context?.content ?? ''),
    payload: (event.context?.payload as
      | Record<string, unknown>
      | undefined) ?? {
      eventKey: event.eventKey,
    },
  }),
  'user.followed': ({ definition, event }) => ({
    mode: 'append' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    categoryKey: definition.notification!.categoryKey,
    projectionKey: String(event.context?.projectionKey ?? ''),
    mandatory: definition.notification!.mandatory,
    actorUserId: event.operatorId ?? undefined,
    title: String(event.context?.title ?? ''),
    content: String(event.context?.content ?? ''),
    payload: (event.context?.payload as
      | Record<string, unknown>
      | undefined) ?? {
      eventKey: event.eventKey,
    },
  }),
  'announcement.published': ({ definition, event }) => ({
    mode: 'upsert' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    categoryKey: definition.notification!.categoryKey,
    projectionKey: String(event.context?.projectionKey ?? ''),
    mandatory: definition.notification!.mandatory,
    actorUserId: event.operatorId ?? undefined,
    title: String(event.context?.title ?? ''),
    content: String(event.context?.content ?? ''),
    payload: (event.context?.payload as
      | Record<string, unknown>
      | undefined) ?? {
      eventKey: event.eventKey,
    },
  }),
  'announcement.unpublished': ({ definition, event }) => ({
    mode: 'delete' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    projectionKey: String(event.context?.projectionKey ?? ''),
  }),
  'task.reminder.auto_assigned': ({ definition, event }) => ({
    mode: 'append' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    categoryKey: definition.notification!.categoryKey,
    projectionKey: String(event.context?.projectionKey ?? ''),
    mandatory: definition.notification!.mandatory,
    actorUserId: event.operatorId ?? undefined,
    title: String(event.context?.title ?? ''),
    content: String(event.context?.content ?? ''),
    expiresAt: event.context?.expiresAt
      ? new Date(String(event.context.expiresAt))
      : undefined,
    payload: (event.context?.payload as
      | Record<string, unknown>
      | undefined) ?? {
      eventKey: event.eventKey,
    },
  }),
  'task.reminder.expiring': ({ definition, event }) => ({
    mode: 'append' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    categoryKey: definition.notification!.categoryKey,
    projectionKey: String(event.context?.projectionKey ?? ''),
    mandatory: definition.notification!.mandatory,
    actorUserId: event.operatorId ?? undefined,
    title: String(event.context?.title ?? ''),
    content: String(event.context?.content ?? ''),
    expiresAt: event.context?.expiresAt
      ? new Date(String(event.context.expiresAt))
      : undefined,
    payload: (event.context?.payload as
      | Record<string, unknown>
      | undefined) ?? {
      eventKey: event.eventKey,
    },
  }),
  'task.reminder.reward_granted': ({ definition, event }) => ({
    mode: 'append' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    categoryKey: definition.notification!.categoryKey,
    projectionKey: String(event.context?.projectionKey ?? ''),
    mandatory: definition.notification!.mandatory,
    actorUserId: event.operatorId ?? undefined,
    title: String(event.context?.title ?? ''),
    content: String(event.context?.content ?? ''),
    payload: (event.context?.payload as
      | Record<string, unknown>
      | undefined) ?? {
      eventKey: event.eventKey,
    },
  }),
}

/**
 * 通知事件 consumer。
 * 使用固定 handler map 生成投影命令，并驱动 notification projection、delivery 和实时同步。
 */
@Injectable()
export class NotificationEventConsumer {
  constructor(
    private readonly notificationProjectionService: NotificationProjectionService,
    private readonly messageNotificationDeliveryService: MessageNotificationDeliveryService,
    private readonly messageNotificationRealtimeService: MessageNotificationRealtimeService,
  ) {}

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
      this.messageNotificationRealtimeService.emitNotificationCreated(
        result.notification,
      )
    }
    if (result.action === 'upsert' && result.notification) {
      this.messageNotificationRealtimeService.emitNotificationUpdated(
        result.notification,
      )
    }
    if (
      result.action === 'delete' &&
      result.receiverUserId &&
      result.projectionKey
    ) {
      this.messageNotificationRealtimeService.emitNotificationDeleted(
        result.receiverUserId,
        {
          projectionKey: result.projectionKey,
          notificationId:
            typeof (result.notification as { id?: unknown } | undefined)?.id ===
            'number'
              ? (result.notification as { id?: number }).id
              : undefined,
        },
      )
    }

    if (result.receiverUserId) {
      const summary = await this.notificationProjectionService.getInboxSummary(
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
}
