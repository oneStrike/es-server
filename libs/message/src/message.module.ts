import { Module } from '@nestjs/common'
import { MessageNotificationModule } from './notification/notification.module'
import { MessageOutboxModule } from './outbox/outbox.module'

@Module({
  imports: [MessageNotificationModule, MessageOutboxModule],
  exports: [MessageNotificationModule, MessageOutboxModule],
})
export class MessageModule {}
