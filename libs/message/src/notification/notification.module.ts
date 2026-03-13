import { JwtAuthModule } from '@libs/platform/modules/auth'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MessageInboxModule } from '../inbox/inbox.module'
import { MessageMonitorModule } from '../monitor/monitor.module'
import { MessageNativeWebSocketServer } from './notification-native-websocket.server'
import { MessageNotificationRealtimeService } from './notification-realtime.service'
import { MessageWebSocketService } from './notification-websocket.service'
import { MessageGateway } from './notification.gateway'
import { MessageNotificationService } from './notification.service'

@Module({
  imports: [ConfigModule, JwtAuthModule, MessageInboxModule, MessageMonitorModule],
  providers: [
    MessageWebSocketService,
    MessageNativeWebSocketServer,
    MessageGateway,
    MessageNotificationRealtimeService,
    MessageNotificationService,
  ],
  exports: [
    MessageNativeWebSocketServer,
    MessageNotificationService,
    MessageNotificationRealtimeService,
    MessageWebSocketService,
  ],
})
export class MessageNotificationModule {}
