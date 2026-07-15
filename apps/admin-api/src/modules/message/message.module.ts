import { MessageEventConsumerModule } from '@libs/message/eventing/message-event-consumer.module'
import { MessageAdminMonitorModule } from '@libs/message/monitor/message-admin-monitor.module'
import { MessageNotificationCoreModule } from '@libs/message/notification/notification-core.module'
import { Module } from '@nestjs/common'
import { AdminUserModule } from '../admin-user/admin-user.module'
import { MessageTemplateController } from './message-template.controller'
import { MessageTemplateService } from './message-template.service'
import { MessageController } from './message.controller'

@Module({
  imports: [
    AdminUserModule,
    MessageEventConsumerModule,
    MessageNotificationCoreModule,
    MessageAdminMonitorModule,
  ],
  controllers: [MessageController, MessageTemplateController],
  providers: [MessageTemplateService],
})
export class MessageModule {}
