import { DomainEventDispatchService } from '@libs/platform/modules/eventing/domain-event-dispatch.service'
import { DOMAIN_EVENT_DISPATCH_MAX_RETRY, DomainEventConsumerEnum } from '@libs/platform/modules/eventing/eventing.constant'
import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { MessageNotificationDeliveryService } from '../notification/notification-delivery.service'
import { MessageNotificationDispatchStatusEnum } from '../notification/notification.constant'
import { ChatRealtimeEventConsumer } from './chat-realtime-event.consumer'
import { NotificationEventConsumer } from './notification-event.consumer'

/**
 * 消息域领域事件 dispatch worker。
 * 当前显式处理 notification 与 chat_realtime 两类 consumer。
 */
@Injectable()
export class MessageDomainEventDispatchWorker {
  constructor(
    private readonly domainEventDispatchService: DomainEventDispatchService,
    private readonly notificationEventConsumer: NotificationEventConsumer,
    private readonly chatRealtimeEventConsumer: ChatRealtimeEventConsumer,
    private readonly messageNotificationDeliveryService: MessageNotificationDeliveryService,
  ) {}

  @Cron('*/5 * * * * *')
  async consumePendingDispatches() {
    const consumers = [
      DomainEventConsumerEnum.NOTIFICATION,
      DomainEventConsumerEnum.CHAT_REALTIME,
    ] as const

    await this.domainEventDispatchService.recoverStaleDispatches([...consumers])
    const claimedDispatches
      = await this.domainEventDispatchService.claimPendingDispatchBatch([
        ...consumers,
      ])

    for (const item of claimedDispatches) {
      try {
        if (item.dispatch.consumer === DomainEventConsumerEnum.NOTIFICATION) {
          await this.notificationEventConsumer.consume(item.event, item.dispatch)
        } else if (
          item.dispatch.consumer === DomainEventConsumerEnum.CHAT_REALTIME
        ) {
          await this.chatRealtimeEventConsumer.consume(item.event, item.dispatch)
        }

        await this.domainEventDispatchService.markDispatchSucceeded(
          item.dispatch.id,
        )
      } catch (error) {
        if (item.dispatch.consumer === DomainEventConsumerEnum.NOTIFICATION) {
          const status =
            item.dispatch.retryCount + 1 >= DOMAIN_EVENT_DISPATCH_MAX_RETRY
              ? MessageNotificationDispatchStatusEnum.FAILED
              : MessageNotificationDispatchStatusEnum.RETRYING
          await this.messageNotificationDeliveryService.recordFailedDispatch(
            item.event,
            item.dispatch,
            {
              status,
              failureReason: this.stringifyError(error),
            },
          )
        }
        await this.domainEventDispatchService.markDispatchFailed(
          item.dispatch,
          error,
        )
      }
    }
  }

  private stringifyError<T>(error: T) {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown error'
    }
  }
}
