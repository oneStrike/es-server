import { Module } from '@nestjs/common'
import { MessageNotificationModule } from './notification/notification.module'
import { MessageOutboxModule } from './outbox/outbox.module'

/**
 * 消息模块
 * 整合通知模块和发件箱模块，提供统一的消息处理能力
 */
@Module({
  imports: [MessageNotificationModule, MessageOutboxModule],
  exports: [MessageNotificationModule, MessageOutboxModule],
})
export class MessageModule {}
