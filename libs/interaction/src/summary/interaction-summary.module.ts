import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { InteractionSummaryReadService } from './interaction-summary-read.service'

@Module({
  imports: [DrizzleModule],
  providers: [InteractionSummaryReadService],
  exports: [InteractionSummaryReadService],
})
export class InteractionSummaryModule {}
