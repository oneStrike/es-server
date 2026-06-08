import { MessageDomainEventModule } from '@libs/message/eventing/message-domain-event.module'
import { MessageNotificationCoreModule } from '@libs/message/notification/notification-core.module'
import { Module } from '@nestjs/common'
import { AdminUserModule } from '../admin-user/admin-user.module'
import { MessageChatInvestigationService } from './message-chat-investigation.service'
import { MessageMonitorService } from './message-monitor.service'
import { MessageTemplateController } from './message-template.controller'
import { MessageTemplateService } from './message-template.service'
import { MessageController } from './message.controller'

@Module({
  imports: [
    AdminUserModule,
    MessageDomainEventModule,
    MessageNotificationCoreModule,
  ],
  controllers: [MessageController, MessageTemplateController],
  providers: [
    MessageChatInvestigationService,
    MessageMonitorService,
    MessageTemplateService,
  ],
})
export class MessageModule {}
