import { UploadModule } from '@libs/base/modules'

import { Module } from '@nestjs/common'
import { ChapterContentController } from './chapter-content.controller'
import { ChapterContentService } from './chapter-content.service'

/**
 * 漫画章节内容模块
 * 管理漫画章节内容相关的服务和控制器
 */
@Module({
  imports: [UploadModule],
  controllers: [ChapterContentController],
  providers: [ChapterContentService],
  exports: [ChapterContentService],
})
export class ChapterContentModule {}
