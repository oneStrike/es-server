import { Module } from '@nestjs/common'
import { CommentLikeService } from './comment-like.service'

@Module({
  providers: [CommentLikeService],
  exports: [CommentLikeService],
})
export class CommentLikeModule {}
