import { Module } from '@nestjs/common'
import { GrowthRewardRuleService } from './reward-rule.service'

@Module({
  providers: [GrowthRewardRuleService],
  exports: [GrowthRewardRuleService],
})
export class GrowthRewardRuleModule {}
