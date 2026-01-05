import { Module } from '@nestjs/common'
import { ForumSectionService } from './forum-section.service'
import { SectionPermissionService } from './section-permission.service'

/**
 * 论坛板块模块
 * 提供论坛板块管理的完整功能
 */
@Module({
  providers: [ForumSectionService, SectionPermissionService],
  exports: [ForumSectionService, SectionPermissionService],
})
export class ForumSectionModule {}
