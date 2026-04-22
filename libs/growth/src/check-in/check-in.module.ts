import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { GrowthRewardSettlementModule } from '@libs/growth/growth-reward/growth-reward-settlement.module'
import { Module } from '@nestjs/common'
import { CheckInDefinitionService } from './check-in-definition.service'
import { CheckInExecutionService } from './check-in-execution.service'
import { CheckInMakeupService } from './check-in-makeup.service'
import { CheckInRewardPolicyService } from './check-in-reward-policy.service'
import { CheckInRuntimeService } from './check-in-runtime.service'
import { CheckInSettlementService } from './check-in-settlement.service'
import { CheckInStreakService } from './check-in-streak.service'
import { CheckInService } from './check-in.service'

@Module({
  imports: [GrowthLedgerModule, GrowthRewardSettlementModule],
  providers: [
    CheckInRewardPolicyService,
    CheckInMakeupService,
    CheckInStreakService,
    CheckInSettlementService,
    CheckInDefinitionService,
    CheckInExecutionService,
    CheckInRuntimeService,
    CheckInService,
  ],
  exports: [CheckInService],
})
export class CheckInModule {}
