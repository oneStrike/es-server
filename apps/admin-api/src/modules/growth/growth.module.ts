import { EventDefinitionModule } from '@libs/growth/event-definition/event-definition.module'
import { GrowthEventBridgeModule } from '@libs/growth/growth-reward/growth-event-bridge.module'
import { GrowthRewardSettlementModule } from '@libs/growth/growth-reward/growth-reward-settlement.module'
import { GrowthAdminModule } from '@libs/growth/growth/growth-admin.module'
import { Module } from '@nestjs/common'
import { BadgeModule } from './badge/badge.module'
import { ExperienceModule } from './experience/experience.module'
import { GrowthController } from './growth.controller'
import { LevelRuleModule } from './level-rule/level-rule.module'
import { RewardRuleModule } from './reward-rule/reward-rule.module'

@Module({
  imports: [
    ExperienceModule,
    LevelRuleModule,
    BadgeModule,
    EventDefinitionModule,
    GrowthEventBridgeModule,
    GrowthRewardSettlementModule,
    RewardRuleModule,
    GrowthAdminModule,
  ],
  controllers: [GrowthController],
})
export class GrowthModule {}
