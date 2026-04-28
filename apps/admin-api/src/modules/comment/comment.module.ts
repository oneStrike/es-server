import { ForumModeratorModule as ForumModeratorModuleLib } from '@libs/forum/moderator/moderator.module'
import { CommentModule as InteractionCommentModule } from '@libs/interaction/comment/comment.module'
import { Module } from '@nestjs/common'
import { CommentController } from './comment.controller'

@Module({
  imports: [ForumModeratorModuleLib, InteractionCommentModule],
  controllers: [CommentController],
})
export class AdminCommentModule {}
