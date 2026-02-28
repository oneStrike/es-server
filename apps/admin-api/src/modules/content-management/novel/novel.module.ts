import { WorkCommentModule, WorkModule } from '@libs/content/work'
import { Module } from '@nestjs/common'
import { NovelChapterCommentController } from './novel-chapter-comment.controller'
import { NovelChapterController } from './novel-chapter.controller'
import { NovelContentController } from './novel-content.controller'
import { NovelController } from './novel.controller'

@Module({
  imports: [WorkModule, WorkCommentModule],
  controllers: [
    NovelController,
    NovelChapterController,
    NovelChapterCommentController,
    NovelContentController,
  ],
  providers: [],
  exports: [],
})
export class NovelModule {}
