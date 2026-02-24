import { ContentModule, WorkChapterModule, WorkCommentModule, WorkModule } from '@libs/content/work'
import { Module } from '@nestjs/common'
import { NovelChapterCommentController } from './novel-chapter-comment.controller'
import { NovelChapterController } from './novel-chapter.controller'
import { NovelContentController } from './novel-content.controller'
import { NovelController } from './novel.controller'

@Module({
  imports: [WorkModule, WorkChapterModule, WorkCommentModule, ContentModule],
  controllers: [
    NovelController,
    NovelChapterController,
    NovelChapterCommentController,
    NovelContentController,
  ],
  providers: [],
  exports: [WorkModule, WorkChapterModule, WorkCommentModule, ContentModule],
})
export class NovelModule {}
