import { Module } from '@nestjs/common'
import { MessageChatWsCommandModule } from './notification-chat-ws-command.module'
import { MessageNotificationCoreModule } from './notification-core.module'
import { MessageGateway } from './notification.gateway'

@Module({
  imports: [MessageNotificationCoreModule, MessageChatWsCommandModule],
  providers: [MessageGateway],
  exports: [MessageNotificationCoreModule],
})
export class MessageNotificationModule {}
