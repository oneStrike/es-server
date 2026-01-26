import { ComicChapterModule as ComicChapterModuleLib } from '@libs/content/comic/chapter'
import { Module } from '@nestjs/common'
import { ComicChapterController } from './comic-chapter.controller'

/**
 * 漫画章节模块
 * 提供漫画章节管理的完整功能
 */
@Module({
  imports: [ComicChapterModuleLib],
  controllers: [ComicChapterController],
  providers: [],
  exports: [ComicChapterModuleLib],
})
export class ComicChapterModule {}
