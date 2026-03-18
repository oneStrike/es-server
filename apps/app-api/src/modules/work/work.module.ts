import { WorkModule as WorkCoreModule } from '@libs/content'
import { Module } from '@nestjs/common'
import { WorkChapterController } from './work-chapter.controller'
import { WorkController } from './work.controller'

@Module({
  imports: [WorkCoreModule],
  controllers: [
    WorkController,
    WorkChapterController,
  ],
})
export class WorkModule {}
