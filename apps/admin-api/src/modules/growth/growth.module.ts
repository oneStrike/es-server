import { EventDefinitionModule } from '@libs/growth/event-definition'
import { Module } from '@nestjs/common'
import { BadgeModule } from './badge/badge.module'
import { ExperienceModule } from './experience/experience.module'
import { GrowthController } from './growth.controller'
import { GrowthService } from './growth.service'
import { LevelRuleModule } from './level-rule/level-rule.module'
import { PointModule } from './point/point.module'

@Module({
  imports: [
    PointModule,
    ExperienceModule,
    LevelRuleModule,
    BadgeModule,
    EventDefinitionModule,
  ],
  controllers: [GrowthController],
  providers: [GrowthService],
})
export class GrowthModule {}
