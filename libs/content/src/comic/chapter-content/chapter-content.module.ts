import { UploadModule } from '@libs/base/modules'
import { Module } from '@nestjs/common'
import { ChapterContentService } from './chapter-content.service'

/**
 * 漫画章节内容核心模块 Lib
 */
@Module({
  imports: [UploadModule],
  providers: [ChapterContentService],
  exports: [ChapterContentService],
})
export class ChapterContentModule {}
