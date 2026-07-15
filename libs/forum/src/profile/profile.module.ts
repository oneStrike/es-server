import { DrizzleModule } from '@db/core'
import { InteractionModule } from '@libs/interaction/interaction.module'
import { Module } from '@nestjs/common'
import { ForumPermissionModule } from '../permission/forum-permission.module'
import { UserProfileService } from './profile.service'

/**
 * 用户资料模块
 * 提供用户资料、积分、经验等管理功能
 */
@Module({
  imports: [DrizzleModule, InteractionModule, ForumPermissionModule],
  providers: [UserProfileService],
  exports: [UserProfileService],
})
export class UserProfileModule {}
