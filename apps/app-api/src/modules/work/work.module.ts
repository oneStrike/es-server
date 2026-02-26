import { WorkChapterModule } from '@libs/content/work/chapter'
import { WorkCommentModule } from '@libs/content/work/comment'
import { WorkModule as WorkCoreModule } from '@libs/content/work/core'
import { Module } from '@nestjs/common'
import { WorkChapterController } from './work-chapter.controller'
import { WorkController } from './work.controller'

@Module({
  imports: [WorkCoreModule, WorkChapterModule, WorkCommentModule],
  controllers: [WorkController, WorkChapterController],
})
export class WorkModule {}
