import { InteractionModule } from '@libs/interaction/interaction'
import { Module } from '@nestjs/common'
import { ForumCounterModule } from '../counter'
import { ForumPermissionModule } from '../permission'
import { ForumSectionService } from './forum-section.service'
import { ForumSectionFollowResolver } from './resolver/forum-section-follow.resolver'

/**
 * 论坛板块模块
 * 提供论坛板块管理的完整功能
 */
@Module({
  imports: [InteractionModule, ForumPermissionModule, ForumCounterModule],
  providers: [ForumSectionService, ForumSectionFollowResolver],
  exports: [ForumSectionService],
})
export class ForumSectionModule {}
