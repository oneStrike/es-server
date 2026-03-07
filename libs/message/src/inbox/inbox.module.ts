import { Module } from '@nestjs/common'
import { MessageInboxService } from './inbox.service'

@Module({
  providers: [MessageInboxService],
  exports: [MessageInboxService],
})
export class MessageInboxModule {}
