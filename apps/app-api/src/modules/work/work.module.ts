import { WorkModule as WorkCoreModule } from '@libs/content'
import { CommentModule as CommentCoreModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { WorkChapterController } from './work-chapter.controller'
import { WorkController } from './work.controller'

@Module({
  imports: [WorkCoreModule, CommentCoreModule],
  controllers: [
    WorkController,
    WorkChapterController,
  ],
})
export class WorkModule {}
