import { EmojiModule } from '@libs/interaction/emoji/emoji.module'
import { SystemConfigModule } from '@libs/system-config/system-config.module'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MessageDomainEventModule } from '../eventing/message-domain-event.module'
import { MessageInboxModule } from '../inbox/inbox.module'
import { MessageMonitorModule } from '../monitor/monitor.module'
import { MessageNotificationCoreModule } from '../notification/notification-core.module'
import { MessageChatReadQueryService } from './chat-read-query.service'
import { MESSAGE_CHAT_SERVICE_TOKEN } from './chat.constant'
import { MessageChatService } from './chat.service'

@Module({
  imports: [
    ConfigModule,
    SystemConfigModule,
    MessageNotificationCoreModule,
    MessageInboxModule,
    MessageMonitorModule,
    MessageDomainEventModule,
    EmojiModule,
  ],
  providers: [
    MessageChatReadQueryService,
    MessageChatService,
    {
      provide: MESSAGE_CHAT_SERVICE_TOKEN,
      useExisting: MessageChatService,
    },
  ],
  exports: [MessageChatService, MESSAGE_CHAT_SERVICE_TOKEN],
})
export class MessageChatModule {}
