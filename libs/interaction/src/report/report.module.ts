import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { InteractionTargetResolverService } from '../interaction-target-resolver.service'
import { ReportService } from './report.service'

@Module({
  imports: [GrowthLedgerModule],
  providers: [InteractionTargetResolverService, ReportService],
  exports: [ReportService],
})
export class ReportModule {}
