import { Module } from '@nestjs/common'
import { GrowthLedgerService } from './growth-ledger.service'

@Module({
  providers: [GrowthLedgerService],
  exports: [GrowthLedgerService],
})
export class GrowthLedgerModule {}
