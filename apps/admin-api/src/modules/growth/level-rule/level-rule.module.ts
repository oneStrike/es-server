import { UserLevelRuleModule } from '@libs/growth/level-rule/level-rule.module';
import { Module } from '@nestjs/common'
import { LevelRuleController } from './level-rule.controller'

@Module({
  imports: [UserLevelRuleModule],
  controllers: [LevelRuleController],
  providers: [],
  exports: [],
})
export class LevelRuleModule {}
