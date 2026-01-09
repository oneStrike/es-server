import { Module } from '@nestjs/common'
import { ForumBadgeModule } from './badge/badge.module'
import { LevelRuleModule } from './level-rule/level-rule.module'
import { ModeratorModule } from './moderator/moderator.module'
import { PointModule } from './point/point.module'
import { SensitiveWordModule } from './sensitive-word/sensitive-word.module'

@Module({
  imports: [ForumBadgeModule, LevelRuleModule, ModeratorModule, PointModule, SensitiveWordModule],
})
export class ForumManagementModule {}
