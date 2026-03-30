import { JwtAuthModule } from '@libs/platform/modules/auth'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MessageInboxModule } from '../inbox/inbox.module'
import { MessageMonitorModule } from '../monitor/monitor.module'
import { MessageNotificationComposerService } from './notification-composer.service'
import { MessageNotificationDeliveryService } from './notification-delivery.service'
import { MessageNativeWebSocketServer } from './notification-native-websocket.server'
import { MessageNotificationPreferenceService } from './notification-preference.service'
import { MessageNotificationRealtimeService } from './notification-realtime.service'
import { MessageNotificationTemplateService } from './notification-template.service'
import { MessageWebSocketService } from './notification-websocket.service'
import { MessageGateway } from './notification.gateway'
import { MessageNotificationService } from './notification.service'

@Module({
  imports: [ConfigModule, JwtAuthModule, MessageInboxModule, MessageMonitorModule],
  providers: [
    MessageWebSocketService,
    MessageNativeWebSocketServer,
    MessageGateway,
    MessageNotificationComposerService,
    MessageNotificationDeliveryService,
    MessageNotificationRealtimeService,
    MessageNotificationPreferenceService,
    MessageNotificationTemplateService,
    MessageNotificationService,
  ],
  exports: [
    MessageNativeWebSocketServer,
    MessageNotificationComposerService,
    MessageNotificationDeliveryService,
    MessageNotificationPreferenceService,
    MessageNotificationService,
    MessageNotificationRealtimeService,
    MessageNotificationTemplateService,
    MessageWebSocketService,
  ],
})
export class MessageNotificationModule {}
