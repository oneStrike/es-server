import { MessageDomainEventModule } from '@libs/message/eventing/message-domain-event.module';
import { MessageNotificationModule } from '@libs/message/notification/notification.module';
import { Module } from '@nestjs/common'
import { MessageMonitorService } from './message-monitor.service'
import { MessageTemplateController } from './message-template.controller'
import { MessageTemplateService } from './message-template.service'
import { MessageController } from './message.controller'

@Module({
  imports: [MessageDomainEventModule, MessageNotificationModule],
  controllers: [MessageController, MessageTemplateController],
  providers: [
    MessageMonitorService,
    MessageTemplateService,
  ],
})
export class MessageModule {}
