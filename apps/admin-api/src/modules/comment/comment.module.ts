import { CommentModule as InteractionCommentModule } from '@libs/interaction/comment'
import { Module } from '@nestjs/common'
import { CommentController } from './comment.controller'

@Module({
  imports: [InteractionCommentModule],
  controllers: [CommentController],
})
export class AdminCommentModule {}
