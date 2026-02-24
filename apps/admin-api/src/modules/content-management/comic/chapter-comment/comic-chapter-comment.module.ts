import { WorkCommentModule } from '@libs/content/work/comment'
import { Module } from '@nestjs/common'
import { ComicChapterCommentController } from './comic-chapter-comment.controller'

@Module({
  imports: [WorkCommentModule],
  controllers: [ComicChapterCommentController],
  providers: [],
  exports: [WorkCommentModule],
})
export class ComicChapterCommentModule {}
