import { JwtAuthModule } from '@libs/base/modules/auth'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MessageInboxModule } from '../inbox/inbox.module'
import { MessageMonitorModule } from '../monitor/monitor.module'
import { MessageNativeWebSocketServer } from './notification-native-websocket.server'
import { MessageNotificationRealtimeService } from './notification-realtime.service'
import { MessageGateway } from './notification.gateway'
import { MessageWebSocketService } from './notification-websocket.service'
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
