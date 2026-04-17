import { GrowthRewardRuleModule as LibGrowthRewardRuleModule } from '@libs/growth/reward-rule/reward-rule.module'
import { Module } from '@nestjs/common'
import { RewardRuleController } from './reward-rule.controller'

@Module({
  imports: [LibGrowthRewardRuleModule],
  controllers: [RewardRuleController],
})
export class RewardRuleModule {}
