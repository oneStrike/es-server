import { Module } from '@nestjs/common'
import { MessageInboxSummaryQueryService } from './inbox-summary-query.service'
import { MessageInboxService } from './inbox.service'

@Module({
  providers: [MessageInboxSummaryQueryService, MessageInboxService],
  exports: [MessageInboxService],
})
export class MessageInboxModule {}
