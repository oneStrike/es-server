import { WorkChapterModule } from '@libs/content/work/chapter'
import { WorkCommentModule } from '@libs/content/work/comment'
import { WorkModule } from '@libs/content/work/core'
import { Module } from '@nestjs/common'
import { NovelChapterCommentController } from './novel-chapter-comment.controller'
import { NovelChapterController } from './novel-chapter.controller'
import { NovelController } from './novel.controller'

@Module({
  imports: [WorkModule, WorkChapterModule, WorkCommentModule],
  controllers: [
    NovelController,
    NovelChapterController,
    NovelChapterCommentController,
  ],
})
export class NovelModule {}
