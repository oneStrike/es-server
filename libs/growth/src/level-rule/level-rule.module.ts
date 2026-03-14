import { Module } from '@nestjs/common'
import { UserLevelRuleService } from './level-rule.service'

@Module({
  providers: [UserLevelRuleService],
  exports: [UserLevelRuleService],
})
export class UserLevelRuleModule {}
