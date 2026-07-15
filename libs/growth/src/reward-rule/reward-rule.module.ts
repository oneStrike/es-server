import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { EventDefinitionModule } from '../event-definition/event-definition.module'
import { GrowthRewardRuleService } from './reward-rule.service'

@Module({
  imports: [DrizzleModule, EventDefinitionModule],
  providers: [GrowthRewardRuleService],
  exports: [GrowthRewardRuleService],
})
export class GrowthRewardRuleModule {}
