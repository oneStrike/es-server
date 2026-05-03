import { JwtAuthModule } from '@libs/platform/modules/auth/auth.module'
import { UserModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MessageInboxModule } from '../inbox/inbox.module'
import { MessageMonitorModule } from '../monitor/monitor.module'
import { MessageNotificationDeliveryService } from './notification-delivery.service'
import { MessageNotificationPreferenceService } from './notification-preference.service'
import { MessageNotificationRealtimeService } from './notification-realtime.service'
import { MessageNotificationTemplateService } from './notification-template.service'
import { MessageWebSocketService } from './notification-websocket.service'
import { MessageGateway } from './notification.gateway'
import { MessageNotificationService } from './notification.service'

@Module({
  imports: [
    ConfigModule,
    JwtAuthModule,
    MessageInboxModule,
    MessageMonitorModule,
    UserModule,
  ],
  providers: [
    MessageWebSocketService,
    MessageGateway,
    MessageNotificationDeliveryService,
    MessageNotificationRealtimeService,
    MessageNotificationPreferenceService,
    MessageNotificationTemplateService,
    MessageNotificationService,
  ],
  exports: [
    MessageNotificationDeliveryService,
    MessageNotificationPreferenceService,
    MessageNotificationService,
    MessageNotificationRealtimeService,
    MessageNotificationTemplateService,
    MessageWebSocketService,
  ],
})
export class MessageNotificationModule {}
