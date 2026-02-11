import { Module } from '@nestjs/common'
import { UserLevelRuleService } from './level-rule.service'

/**
 * 等级规则模块
 * 提供用户等级规则管理的完整功能
 */
@Module({
  imports: [],
  providers: [UserLevelRuleService],
  exports: [UserLevelRuleService],
})
export class UserLevelRuleModule {}
