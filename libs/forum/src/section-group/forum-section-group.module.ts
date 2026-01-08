import { Module } from '@nestjs/common'
import { ForumSectionGroupService } from './forum-section-group.service'

/**
 * 论坛板块分组模块
 * 提供论坛板块分组管理的完整功能
 */
@Module({
  controllers: [],
  providers: [ForumSectionGroupService],
  exports: [ForumSectionGroupService],
})
export class ForumSectionGroupModule {}
