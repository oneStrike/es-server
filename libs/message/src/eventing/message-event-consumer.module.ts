import { DrizzleModule } from '@db/core'
import { EventingModule } from '@libs/eventing/eventing/eventing.module'
import { Module } from '@nestjs/common'
import { MessageChatModule } from '../chat/chat.module'
import { MessageInboxModule } from '../inbox/inbox.module'
import { MessageNotificationCoreModule } from '../notification/notification-core.module'
import { MessageEventDispatchWorker } from './message-event-dispatch.worker'
import { NotificationEventConsumer } from './notification-event.consumer'
import { NotificationProjectionService } from './notification-projection.service'

/**
 * message consumer dispatch 组合模块。
 *
 * 仅装配通知和聊天实时 consumer，不定义或发布其他领域的业务事实。
 */
@Module({
  imports: [
    DrizzleModule,
    EventingModule,
    MessageChatModule,
    MessageNotificationCoreModule,
    MessageInboxModule,
  ],
  providers: [
    NotificationProjectionService,
    NotificationEventConsumer,
    MessageEventDispatchWorker,
  ],
  exports: [NotificationProjectionService, NotificationEventConsumer],
})
export class MessageEventConsumerModule {}
