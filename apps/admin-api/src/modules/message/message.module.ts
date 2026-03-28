import {
  MessageNotificationDeliveryService,
  MessageNotificationTemplateService,
} from '@libs/message/notification'
import { Module } from '@nestjs/common'
import { MessageMonitorService } from './message-monitor.service'
import { MessageTemplateController } from './message-template.controller'
import { MessageTemplateService } from './message-template.service'
import { MessageController } from './message.controller'

@Module({
  controllers: [MessageController, MessageTemplateController],
  providers: [
    MessageMonitorService,
    MessageNotificationDeliveryService,
    MessageNotificationTemplateService,
    MessageTemplateService,
  ],
})
export class MessageModule {}
