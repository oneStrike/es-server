import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { ReportService } from './report.service'

@Module({
  imports: [GrowthLedgerModule],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
