import { ChapterContentModule as ChapterContentModuleLib } from '@libs/content/comic/chapter-content'
import { Module } from '@nestjs/common'
import { ChapterContentController } from './chapter-content.controller'

/**
 * 漫画章节内容模块
 * 管理漫画章节内容相关的服务和控制器
 */
@Module({
  imports: [ChapterContentModuleLib],
  controllers: [ChapterContentController],
  providers: [],
  exports: [ChapterContentModuleLib],
})
export class ChapterContentModule {}
