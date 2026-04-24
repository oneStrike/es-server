import { EventingModule } from '@libs/platform/modules/eventing/eventing.module'
import { Module } from '@nestjs/common'
import { MessageInboxModule } from '../inbox/inbox.module'
import { MessageNotificationModule } from '../notification/notification.module'
import { ChatRealtimeEventConsumer } from './chat-realtime-event.consumer'
import { MessageDomainEventDispatchWorker } from './message-domain-event-dispatch.worker'
import { MessageDomainEventFactoryService } from './message-domain-event.factory'
import { MessageDomainEventPublisher } from './message-domain-event.publisher'
import { NotificationEventConsumer } from './notification-event.consumer'
import { NotificationProjectionService } from './notification-projection.service'

@Module({
  imports: [EventingModule, MessageNotificationModule, MessageInboxModule],
  providers: [
    MessageDomainEventPublisher,
    MessageDomainEventFactoryService,
    NotificationProjectionService,
    NotificationEventConsumer,
    ChatRealtimeEventConsumer,
    MessageDomainEventDispatchWorker,
  ],
  exports: [
    MessageDomainEventPublisher,
    MessageDomainEventFactoryService,
    NotificationProjectionService,
    NotificationEventConsumer,
    ChatRealtimeEventConsumer,
  ],
})
export class MessageDomainEventModule {}
