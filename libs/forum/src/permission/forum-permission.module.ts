import { DrizzleModule } from '@db/core'
import { UserLevelRuleModule } from '@libs/growth/level-rule/level-rule.module'
import { Module } from '@nestjs/common'
import { ForumPermissionService } from './forum-permission.service'

/**
 * 论坛权限模块。
 * 提供板块访问与发帖权限校验。
 */
@Module({
  imports: [DrizzleModule, UserLevelRuleModule],
  providers: [ForumPermissionService],
  exports: [ForumPermissionService],
})
export class ForumPermissionModule {}
