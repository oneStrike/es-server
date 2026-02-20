import { ComicChapterCommentModule as ComicChapterCommentModuleLib } from '@libs/content/comic/chapter-comment'
import { Module } from '@nestjs/common'
import { ComicChapterCommentController } from './comic-chapter-comment.controller'

@Module({
  imports: [ComicChapterCommentModuleLib],
  controllers: [ComicChapterCommentController],
  providers: [],
  exports: [ComicChapterCommentModuleLib],
})
export class ComicChapterCommentModule {}
