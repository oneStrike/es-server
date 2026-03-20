import { UserLevelRuleModule, UserPointModule } from '@libs/growth'
import { InteractionModule } from '@libs/interaction'
import { UserModule } from '@libs/user'

import { Module } from '@nestjs/common'
import { UserProfileService } from './profile.service'

/**
 * 用户资料模块
 * 提供用户资料、积分、经验等管理功能
 */
@Module({
  imports: [InteractionModule, UserPointModule, UserLevelRuleModule, UserModule],
  providers: [UserProfileService],
  exports: [UserProfileService],
})
export class UserProfileModule {}
