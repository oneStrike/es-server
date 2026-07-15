import { WorkModule } from '@libs/content/work/work.module'
import { Module } from '@nestjs/common'
import { AdminWorkUploadRuntimeModule } from '../work-upload-runtime.module'
import { NovelChapterController } from './novel-chapter.controller'
import { NovelContentController } from './novel-content.controller'
import { NovelController } from './novel.controller'

@Module({
  imports: [WorkModule, AdminWorkUploadRuntimeModule],
  controllers: [
    NovelController,
    NovelChapterController,
    NovelContentController,
  ],
  providers: [],
  exports: [],
})
export class NovelModule {}
