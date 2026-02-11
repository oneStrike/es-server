import { UserLevelRuleModule } from '@libs/user/level-rule'
import { Module } from '@nestjs/common'
import { LevelRuleController } from './level-rule.controller'

@Module({
  imports: [UserLevelRuleModule],
  controllers: [LevelRuleController],
  providers: [],
  exports: [],
})
export class LevelRuleModule {}
