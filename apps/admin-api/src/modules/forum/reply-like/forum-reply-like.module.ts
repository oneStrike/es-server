import { Module } from '@nestjs/common'
import { ForumReplyLikeController } from './forum-reply-like.controller'
import { ForumReplyLikeService } from './forum-reply-like.service'

@Module({
  imports: [],
  controllers: [ForumReplyLikeController],
  providers: [ForumReplyLikeService],
  exports: [ForumReplyLikeService],
})
export class AdminForumReplyLikeModule {}
