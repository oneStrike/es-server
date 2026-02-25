import { InteractionModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { UserLevelRuleService } from './level-rule.service'

@Module({
  imports: [InteractionModule],
  providers: [UserLevelRuleService],
  exports: [UserLevelRuleService],
})
export class UserLevelRuleModule {}
