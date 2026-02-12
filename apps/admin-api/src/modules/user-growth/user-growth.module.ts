import { Module } from '@nestjs/common'
import { BadgeModule } from './badge/badge.module'
import { EventModule } from './event/event.module'
import { ExperienceModule } from './experience/experience.module'
import { LevelRuleModule } from './level-rule/level-rule.module'
import { OverviewModule } from './overview/overview.module'
import { PointModule } from './point/point.module'

@Module({
  imports: [
    PointModule,
    ExperienceModule,
    LevelRuleModule,
    BadgeModule,
    EventModule,
    OverviewModule,
  ],
})
export class UserGrowthModule {}
