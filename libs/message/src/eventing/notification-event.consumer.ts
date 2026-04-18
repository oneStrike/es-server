import type { UserNotificationSelect } from '@db/schema'
import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing'
import type { NotificationActorSource } from '../notification/notification-public.mapper'
import type { NotificationEventHandler } from './message-event.type'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { MessageNotificationDeliveryService } from '../notification/notification-delivery.service'
import { mapUserNotificationToPublicView } from '../notification/notification-public.mapper'
import { MessageNotificationRealtimeService } from '../notification/notification-realtime.service'
import { getMessageDomainEventDefinition } from './message-event.constant'
import { NotificationProjectionService } from './notification-projection.service'

export function getNotificationEventPayload(event: DomainEventRecord) {
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

const NOTIFICATION_EVENT_HANDLERS: Record<string, NotificationEventHandler> = {
  'comment.replied': ({ definition, event }) => ({
    mode: 'append' as const,
    receiverUserId: Number((event.context?.receiverUserId as number) ?? 0),
    categoryKey: definition.notification!.categoryKey,
    projectionKey: String(event.context?.projectionKey ?? ''),
    mandatory: definition.notification!.mandatory,
    actorUserId: event.operatorId ?? undefined,
    title: String(event.context?.title ?? ''),
    content: String(event.context?.content ?? ''),
    payload: getNotificationEventPayload(event),
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
    payload: getNotificationEventPayload(event),
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
    payload: getNotificationEventPayload(event),
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
    payload: getNotificationEventPayload(event),
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
    payload: getNotificationEventPayload(event),
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
    payload: getNotificationEventPayload(event),
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
    payload: getNotificationEventPayload(event),
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
    payload: getNotificationEventPayload(event),
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
    payload: getNotificationEventPayload(event),
  }),
  'announcement.unpublished': ({ event }) => ({
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
    payload: getNotificationEventPayload(event),
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
    payload: getNotificationEventPayload(event),
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
    payload: getNotificationEventPayload(event),
  }),
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
      actor = actorRecord as NotificationActorSource | undefined
    }

    return mapUserNotificationToPublicView(typedNotification, actor)
  }
}
