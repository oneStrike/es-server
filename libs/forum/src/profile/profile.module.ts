import { UserLevelRuleModule } from '@libs/user/level-rule'
import { UserPointModule } from '@libs/user/point'
import { Module } from '@nestjs/common'
import { ForumProfileService } from './profile.service'

/**
 * 论坛资料模块
 * 提供论坛用户资料管理的完整功能
 */
@Module({
  imports: [UserPointModule, UserLevelRuleModule],
  providers: [ForumProfileService],
  exports: [ForumProfileService],
})
export class ForumProfileModule {}
