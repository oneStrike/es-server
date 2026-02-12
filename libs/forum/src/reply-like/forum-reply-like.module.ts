import { UserGrowthEventModule } from '@libs/user/growth-event'
import { Module } from '@nestjs/common'
import { ForumUserActionLogModule } from '../action-log/action-log.module'
import { ForumReplyLikeService } from './forum-reply-like.service'

/**
 * 回复点赞模块
 * 提供回复点赞管理的完整功能
 */
@Module({
  imports: [UserGrowthEventModule, ForumUserActionLogModule],
  providers: [ForumReplyLikeService],
  exports: [ForumReplyLikeService],
})
export class ForumReplyLikeModule {}
