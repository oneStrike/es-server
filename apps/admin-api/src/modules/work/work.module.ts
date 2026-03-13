import { WorkModule as WorkCoreModule } from '@libs/content'
import { Module } from '@nestjs/common'
import { WorkChapterController } from './work-chapter.controller'
import { ComicContentController, NovelContentController } from './work-content.controller'
import { WorkController } from './work.controller'

@Module({
  imports: [WorkCoreModule],
  controllers: [
    WorkController,
    WorkChapterController,
    ComicContentController,
    NovelContentController,
  ],
  providers: [],
  exports: [],
})
export class WorkModule {}
