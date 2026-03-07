import { Module } from '@nestjs/common'
import { MessageInboxModule } from '../inbox/inbox.module'
import { MessageNotificationModule } from '../notification/notification.module'
import { MESSAGE_CHAT_SERVICE_TOKEN } from './chat.constant'
import { MessageChatService } from './chat.service'

@Module({
  imports: [MessageNotificationModule, MessageInboxModule],
  providers: [
    MessageChatService,
    {
      provide: MESSAGE_CHAT_SERVICE_TOKEN,
      useExisting: MessageChatService,
    },
  ],
  exports: [MessageChatService, MESSAGE_CHAT_SERVICE_TOKEN],
})
export class MessageChatModule {}
