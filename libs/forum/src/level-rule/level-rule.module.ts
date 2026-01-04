import { Module } from '@nestjs/common'
import { LevelRuleService } from './level-rule.service'

@Module({
  imports: [],
  providers: [LevelRuleService],
  exports: [LevelRuleService],
})
export class LevelRuleModule {}
