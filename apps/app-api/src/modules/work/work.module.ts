import { WorkModule as WorkCoreModule } from '@libs/content/work/work.module';
import { CommentModule as CommentCoreModule } from '@libs/interaction/comment/comment.module';
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
