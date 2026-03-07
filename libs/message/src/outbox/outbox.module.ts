import { Module } from '@nestjs/common'
import { MessageNotificationModule } from '../notification/notification.module'
import { MessageOutboxService } from './outbox.service'
import { MessageOutboxWorker } from './outbox.worker'

@Module({
  imports: [MessageNotificationModule],
  providers: [MessageOutboxService, MessageOutboxWorker],
  exports: [MessageOutboxService],
})
export class MessageOutboxModule {}
