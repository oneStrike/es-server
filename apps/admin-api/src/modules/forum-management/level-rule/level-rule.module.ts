import { ForumLevelRuleModule as LevelRuleModuleLib } from '@libs/forum/level-rule'
import { Module } from '@nestjs/common'
import { LevelRuleController } from './level-rule.controller'

@Module({
  imports: [LevelRuleModuleLib],
  controllers: [LevelRuleController],
  providers: [],
  exports: [],
})
export class LevelRuleModule {}
