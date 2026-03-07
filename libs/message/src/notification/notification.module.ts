import { JwtAuthModule } from '@libs/base/modules/auth'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MessageInboxModule } from '../inbox/inbox.module'
import { MessageNotificationRealtimeService } from './notification-realtime.service'
import { MessageGateway } from './notification.gateway'
import { MessageNotificationService } from './notification.service'

@Module({
  imports: [ConfigModule, JwtAuthModule, MessageInboxModule],
  providers: [
    MessageGateway,
    MessageNotificationRealtimeService,
    MessageNotificationService,
  ],
  exports: [MessageNotificationService, MessageNotificationRealtimeService],
})
export class MessageNotificationModule {}
