import { WorkCommentModule } from '@libs/content/work/comment'
import { WorkModule as WorkCoreModule } from '@libs/content/work/core'
import { Module } from '@nestjs/common'
import { WorkChapterController } from './work-chapter.controller'
import { WorkController } from './work.controller'

@Module({
  imports: [WorkCoreModule, WorkCommentModule],
  controllers: [WorkController, WorkChapterController],
})
export class WorkModule {}
