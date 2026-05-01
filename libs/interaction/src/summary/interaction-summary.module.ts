import { Module } from '@nestjs/common'
import { InteractionSummaryReadService } from './interaction-summary-read.service'

@Module({
  providers: [InteractionSummaryReadService],
  exports: [InteractionSummaryReadService],
})
export class InteractionSummaryModule {}
