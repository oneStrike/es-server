import { InteractionModule } from '@libs/interaction'
import { UserLevelRuleModule } from '@libs/user/level-rule'
import { UserPointModule } from '@libs/user/point'
import { Module } from '@nestjs/common'
import { ForumProfileService } from './profile.service'

@Module({
  imports: [InteractionModule, UserPointModule, UserLevelRuleModule],
  providers: [ForumProfileService],
  exports: [ForumProfileService],
})
export class ForumProfileModule {}
