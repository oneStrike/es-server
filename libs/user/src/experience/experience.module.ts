import { Module } from '@nestjs/common'
import { ForumLevelRuleModule } from '../level-rule/level-rule.module'
import { ForumExperienceService } from './experience.service'

/**
 * 经验模块
 * 提供论坛经验管理的完整功能
 */
@Module({
  imports: [ForumLevelRuleModule],
  providers: [ForumExperienceService],
  exports: [ForumExperienceService],
})
export class ForumExperienceModule {}
