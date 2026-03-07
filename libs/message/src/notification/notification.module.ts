import { Module } from '@nestjs/common'
import { MessageNotificationService } from './notification.service'

@Module({
  providers: [MessageNotificationService],
  exports: [MessageNotificationService],
})
export class MessageNotificationModule {}
