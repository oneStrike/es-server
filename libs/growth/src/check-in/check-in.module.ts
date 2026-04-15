import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { Module } from '@nestjs/common'
import { CheckInDefinitionService } from './check-in-definition.service'
import { CheckInExecutionService } from './check-in-execution.service'
import { CheckInRuntimeService } from './check-in-runtime.service'
import { CheckInService } from './check-in.service'

@Module({
  imports: [GrowthLedgerModule],
  providers: [
    CheckInDefinitionService,
    CheckInExecutionService,
    CheckInRuntimeService,
    CheckInService,
  ],
  exports: [CheckInService],
})
export class CheckInModule {}
