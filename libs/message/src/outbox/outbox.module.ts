import { Module } from '@nestjs/common'
import { MessageNotificationModule } from '../notification/notification.module'
import { MessageOutboxService } from './outbox.service'
import { MessageOutboxWorker } from './outbox.worker'

/**
 * 消息发件箱模块
 * 实现发件箱模式，确保消息事件的可靠投递
 */
@Module({
  imports: [MessageNotificationModule],
  providers: [MessageOutboxService, MessageOutboxWorker],
  exports: [MessageOutboxService],
})
export class MessageOutboxModule {}
