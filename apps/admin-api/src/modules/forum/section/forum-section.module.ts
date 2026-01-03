import { Module } from '@nestjs/common'
import { ForumSectionController } from './forum-section.controller'
import { ForumSectionService } from './forum-section.service'

/**
 * 论坛板块模块
 * 提供论坛板块管理的完整功能
 */
@Module({
  imports: [],
  controllers: [ForumSectionController],
  providers: [ForumSectionService],
  exports: [ForumSectionService],
})
export class ForumSectionModule {}
