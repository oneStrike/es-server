import { MessageNotificationDeliveryService } from '@libs/message/notification/notification-delivery.service';
import { MessageNotificationTemplateService } from '@libs/message/notification/notification-template.service';
import { MessageOutboxModule } from '@libs/message/outbox/outbox.module';
import { Module } from '@nestjs/common'
import { MessageMonitorService } from './message-monitor.service'
import { MessageTemplateController } from './message-template.controller'
import { MessageTemplateService } from './message-template.service'
import { MessageController } from './message.controller'

@Module({
  imports: [MessageOutboxModule],
  controllers: [MessageController, MessageTemplateController],
  providers: [
    MessageMonitorService,
    MessageNotificationDeliveryService,
    MessageNotificationTemplateService,
    MessageTemplateService,
  ],
})
export class MessageModule {}
