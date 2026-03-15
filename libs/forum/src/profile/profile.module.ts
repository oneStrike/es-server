import { UserLevelRuleModule, UserPointModule } from '@libs/growth'
import { InteractionModule } from '@libs/interaction'

import { Module } from '@nestjs/common'
import { ForumProfileService } from './profile.service'

/**
 * 论坛用户画像模块
 * 提供论坛用户资料、积分、经验等管理功能
 */
@Module({
  imports: [InteractionModule, UserPointModule, UserLevelRuleModule],
  providers: [ForumProfileService],
  exports: [ForumProfileService],
})
export class ForumProfileModule {}
