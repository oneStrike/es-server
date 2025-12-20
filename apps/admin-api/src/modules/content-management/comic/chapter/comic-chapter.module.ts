import { Module } from '@nestjs/common'

import { ComicChapterController } from './comic-chapter.controller'
import { ComicChapterService } from './comic-chapter.service'

/**
 * 漫画章节管理模块
 * 提供漫画章节相关的功能模块
 */
@Module({
  controllers: [ComicChapterController],
  providers: [ComicChapterService],
  exports: [ComicChapterService],
})
export class ComicChapterModule {}
