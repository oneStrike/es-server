import { Module } from '@nestjs/common'
import { ForumTopicLikeController } from './forum-topic-like.controller'
import { ForumTopicLikeService } from './forum-topic-like.service'

@Module({
  controllers: [ForumTopicLikeController],
  providers: [ForumTopicLikeService],
  exports: [ForumTopicLikeService],
})
export class ForumTopicLikeModule {}
