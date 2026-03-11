import { FavoriteModule, LikeModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { UserLevelRuleService } from './level-rule.service'

@Module({
  imports: [LikeModule, FavoriteModule],
  providers: [UserLevelRuleService],
  exports: [UserLevelRuleService],
})
export class UserLevelRuleModule {}
