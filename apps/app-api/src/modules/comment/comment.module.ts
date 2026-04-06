import { CommentModule as CommentCoreModule } from '@libs/interaction/comment/comment.module';
import { Module } from '@nestjs/common'
import { CommentController } from './comment.controller'

@Module({
  imports: [CommentCoreModule],
  controllers: [CommentController],
})
export class CommentModule {}
