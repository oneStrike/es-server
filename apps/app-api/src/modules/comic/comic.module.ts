import { ComicChapterModule } from '@libs/content/comic/chapter'
import { ComicChapterCommentModule } from '@libs/content/comic/chapter-comment'
import { ComicCoreModule } from '@libs/content/comic/core'
import { Module } from '@nestjs/common'
import { ComicChapterCommentController } from './comic-chapter-comment.controller'
import { ComicChapterController } from './comic-chapter.controller'
import { ComicController } from './comic.controller'

@Module({
  imports: [ComicCoreModule, ComicChapterModule, ComicChapterCommentModule],
  controllers: [
    ComicController,
    ComicChapterController,
    ComicChapterCommentController,
  ],
})
export class ComicModule {}
