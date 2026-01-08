import { Module } from '@nestjs/common'
import { LevelRuleService } from './level-rule.service'

/**
 * 等级规则模块
 * 提供论坛等级规则管理的完整功能
 */
@Module({
  imports: [],
  providers: [LevelRuleService],
  exports: [LevelRuleService],
})
export class LevelRuleModule {}
