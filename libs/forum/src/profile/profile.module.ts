import { InteractionModule } from '@libs/interaction'
import { UserLevelRuleModule, UserPointModule } from '@libs/user'

import { Module } from '@nestjs/common'
import { ForumProfileService } from './profile.service'

@Module({
  imports: [InteractionModule, UserPointModule, UserLevelRuleModule],
  providers: [ForumProfileService],
  exports: [ForumProfileService],
})
export class ForumProfileModule {}
