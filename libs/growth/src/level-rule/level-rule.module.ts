import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { UserLevelRuleService } from './level-rule.service'

@Module({
  imports: [DrizzleModule],
  providers: [UserLevelRuleService],
  exports: [UserLevelRuleService],
})
export class UserLevelRuleModule {}
