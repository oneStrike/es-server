import { Module } from '@nestjs/common'
import { ForumTagService } from './forum-tag.service'

/**
 * 论坛标签模块
 * 提供论坛标签管理的完整功能
 */
@Module({
  controllers: [],
  providers: [ForumTagService],
  exports: [ForumTagService],
})
export class ForumTagModule {}
