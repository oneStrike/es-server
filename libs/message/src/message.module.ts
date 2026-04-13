import { Module } from '@nestjs/common'
import { MessageChatModule } from './chat/chat.module'
import { MessageDomainEventModule } from './eventing/message-domain-event.module'
import { MessageInboxModule } from './inbox/inbox.module'
import { MessageMonitorModule } from './monitor/monitor.module'
import { MessageNotificationModule } from './notification/notification.module'

/**
 * 消息模块
 * 整合聊天、通知、inbox 和消息域事件能力
 */
@Module({
  imports: [
    MessageInboxModule,
    MessageMonitorModule,
    MessageNotificationModule,
    MessageDomainEventModule,
    MessageChatModule,
  ],
  exports: [
    MessageInboxModule,
    MessageMonitorModule,
    MessageNotificationModule,
    MessageDomainEventModule,
    MessageChatModule,
  ],
})
export class MessageModule {}
