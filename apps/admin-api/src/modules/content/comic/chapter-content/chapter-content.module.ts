import { WorkModule } from '@libs/content/work/work.module'
import { Module } from '@nestjs/common'
import { AdminWorkUploadRuntimeModule } from '../../work-upload-runtime.module'
import { ChapterContentController } from './chapter-content.controller'

@Module({
  imports: [WorkModule, AdminWorkUploadRuntimeModule],
  controllers: [ChapterContentController],
  providers: [],
  exports: [],
})
export class ChapterContentModule {}
