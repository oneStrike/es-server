import { Module } from '@nestjs/common'
import { ForumViewService } from './forum-view.service'

/**
 * 浏览记录模块
 * 提供论坛浏览记录管理的完整功能
 */
@Module({
  providers: [ForumViewService],
  exports: [ForumViewService],
})
export class ForumViewModule {}
