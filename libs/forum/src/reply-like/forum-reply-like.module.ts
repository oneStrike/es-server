import { Module } from '@nestjs/common'
import { ForumReplyLikeService } from './forum-reply-like.service'

/**
 * 回复点赞模块
 * 提供回复点赞管理的完整功能
 */
@Module({
  imports: [],
  providers: [ForumReplyLikeService],
  exports: [ForumReplyLikeService],
})
export class ForumReplyLikeModule {}
