import { UserLevelRuleModule } from '@libs/growth/level-rule'
import { UserPointModule } from '@libs/growth/point'
import { InteractionModule } from '@libs/interaction/module'
import { UserModule } from '@libs/user/index'
import { Module } from '@nestjs/common'
import { UserProfileService } from './profile.service'

/**
 * 用户资料模块
 * 提供用户资料、积分、经验等管理功能
 */
@Module({
  imports: [
    InteractionModule,
    UserPointModule,
    UserLevelRuleModule,
    UserModule,
  ],
  providers: [UserProfileService],
  exports: [UserProfileService],
})
export class UserProfileModule {}
