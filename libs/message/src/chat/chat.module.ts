import { DrizzleModule } from '@db/core'
import { SystemConfigModule } from '@libs/config/system-config/system-config.module'
import { EventingModule } from '@libs/eventing/eventing/eventing.module'
import { EmojiModule } from '@libs/interaction/emoji/emoji.module'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MessageInboxModule } from '../inbox/inbox.module'
import { MessageMonitorModule } from '../monitor/monitor.module'
import { MessageNotificationCoreModule } from '../notification/notification-core.module'
import { MessageChatReadQueryService } from './chat-read-query.service'
import { ChatRealtimeEventConsumer } from './chat-realtime-event.consumer'
import { MessageChatService } from './chat.service'

@Module({
  imports: [
    DrizzleModule,
    EventingModule,
    ConfigModule,
    SystemConfigModule,
    MessageNotificationCoreModule,
    MessageInboxModule,
    MessageMonitorModule,
    EmojiModule,
  ],
  providers: [
    MessageChatReadQueryService,
    MessageChatService,
    ChatRealtimeEventConsumer,
  ],
  exports: [MessageChatService, ChatRealtimeEventConsumer],
})
export class MessageChatModule {}
