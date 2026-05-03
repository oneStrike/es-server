import { Module } from '@nestjs/common'
import { MessageNotificationCoreModule } from './notification-core.module'
import { MessageGateway } from './notification.gateway'

@Module({
  imports: [MessageNotificationCoreModule],
  providers: [MessageGateway],
  exports: [MessageNotificationCoreModule],
})
export class MessageNotificationModule {}
