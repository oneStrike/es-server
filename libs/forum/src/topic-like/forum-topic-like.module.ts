import { Module } from '@nestjs/common'
import { ForumTopicLikeController } from './forum-topic-like.controller'
import { ForumTopicLikeService } from './forum-topic-like.service'

/**
 * 主题点赞模块
 * 提供主题点赞管理的完整功能
 */
@Module({
  controllers: [ForumTopicLikeController],
  providers: [ForumTopicLikeService],
  exports: [ForumTopicLikeService],
})
export class ForumTopicLikeModule {}
