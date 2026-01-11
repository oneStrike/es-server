import { Module } from '@nestjs/common'
import { ForumCounterModule } from '../counter/forum-counter.module'
import { ForumTopicLikeService } from './forum-topic-like.service'

/**
 * 主题点赞模块
 * 提供主题点赞管理的完整功能
 */
@Module({
  imports: [ForumCounterModule],
  controllers: [],
  providers: [ForumTopicLikeService],
  exports: [ForumTopicLikeService],
})
export class ForumTopicLikeModule {}
