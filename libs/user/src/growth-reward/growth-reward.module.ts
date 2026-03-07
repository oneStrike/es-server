import { Module } from '@nestjs/common'
import { GrowthLedgerModule } from '../growth-ledger/growth-ledger.module'
import { UserLevelRuleModule } from '../level-rule/level-rule.module'
import { UserGrowthRewardService } from './growth-reward.service'

@Module({
  imports: [GrowthLedgerModule, UserLevelRuleModule],
  providers: [UserGrowthRewardService],
  exports: [UserGrowthRewardService],
})
export class UserGrowthRewardModule {}
