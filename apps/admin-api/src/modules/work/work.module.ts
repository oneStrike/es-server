import { WorkModule as WorkCoreModule } from '@libs/content/work/core'
import { Module } from '@nestjs/common'
import { WorkChapterController } from './work-chapter.controller'
import { WorkController } from './work.controller'

@Module({
  imports: [WorkCoreModule],
  controllers: [WorkController, WorkChapterController],
  providers: [],
  exports: [],
})
export class WorkModule {}
