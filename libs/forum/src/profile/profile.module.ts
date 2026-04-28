import { UserLevelRuleModule } from '@libs/growth/level-rule/level-rule.module'
import { InteractionModule } from '@libs/interaction/interaction.module'
import { UserModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { ForumPermissionModule } from '../permission/forum-permission.module'
import { UserProfileService } from './profile.service'

/**
 * 用户资料模块
 * 提供用户资料、积分、经验等管理功能
 */
@Module({
  imports: [
    InteractionModule,
    ForumPermissionModule,
    UserLevelRuleModule,
    UserModule,
  ],
  providers: [UserProfileService],
  exports: [UserProfileService],
})
export class UserProfileModule {}
