import { Module } from '@nestjs/common'
import { LevelRuleModule } from '../level-rule/level-rule.module'
import { ExperienceService } from './experience.service'

/**
 * 经验模块
 * 提供论坛经验管理的完整功能
 */
@Module({
  imports: [LevelRuleModule],
  providers: [ExperienceService],
  exports: [ExperienceService],
})
export class ExperienceModule {}
