import { Module } from '@nestjs/common'
import { ForumLevelRuleModule } from '../level-rule/level-rule.module'
import { ForumPointModule } from '../point/point.module'
import { ForumProfileService } from './profile.service'

/**
 * 论坛资料模块
 * 提供论坛用户资料管理的完整功能
 */
@Module({
  imports: [ForumPointModule, ForumLevelRuleModule],
  providers: [ForumProfileService],
  exports: [ForumProfileService],
})
export class ForumProfileModule {}
