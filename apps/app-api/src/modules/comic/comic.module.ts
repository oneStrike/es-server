import { WorkChapterModule } from '@libs/content/work/chapter'
import { WorkCommentModule } from '@libs/content/work/comment'
import { WorkModule } from '@libs/content/work/core'
import { Module } from '@nestjs/common'
import { ComicChapterCommentController } from './comic-chapter-comment.controller'
import { ComicChapterController } from './comic-chapter.controller'
import { ComicController } from './comic.controller'

@Module({
  imports: [WorkModule, WorkChapterModule, WorkCommentModule],
  controllers: [
    ComicController,
    ComicChapterController,
    ComicChapterCommentController,
  ],
})
export class ComicModule {}
