import { Module } from '@nestjs/common'
import { ForumBadgeModule } from './badge/badge.module'
import { ForumConfigModule } from './config/config.module'
import { ExperienceModule } from './experience/experience.module'
import { LevelRuleModule } from './level-rule/level-rule.module'
import { ModeratorModule } from './moderator/moderator.module'
import { PointModule } from './point/point.module'
import { SensitiveWordModule } from './sensitive-word/sensitive-word.module'
import { ForumTopicModule } from './topic/topic.module'

@Module({
  imports: [
    ForumBadgeModule,
    ForumConfigModule,
    ExperienceModule,
    LevelRuleModule,
    ModeratorModule,
    PointModule,
    SensitiveWordModule,
    ForumTopicModule,
  ],
})
export class ForumManagementModule {}
