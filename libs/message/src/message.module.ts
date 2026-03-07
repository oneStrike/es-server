import { Module } from '@nestjs/common'
import { MessageChatModule } from './chat/chat.module'
import { MessageInboxModule } from './inbox/inbox.module'
import { MessageMonitorModule } from './monitor/monitor.module'
import { MessageNotificationModule } from './notification/notification.module'
import { MessageOutboxModule } from './outbox/outbox.module'

/**
 * 消息模块
 * 整合通知模块和发件箱模块，提供统一的消息处理能力
 */
@Module({
  imports: [
    MessageInboxModule,
    MessageMonitorModule,
    MessageNotificationModule,
    MessageOutboxModule,
    MessageChatModule,
  ],
  exports: [
    MessageInboxModule,
    MessageMonitorModule,
    MessageNotificationModule,
    MessageOutboxModule,
    MessageChatModule,
  ],
})
export class MessageModule {}
