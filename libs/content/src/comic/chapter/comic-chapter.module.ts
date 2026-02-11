import { UserGrowthEventModule } from '@libs/user/growth-event'
import { Module } from '@nestjs/common'
import { ComicChapterService } from './comic-chapter.service'

/**
 * 漫画章节核心模块 Lib
 */
@Module({
  imports: [UserGrowthEventModule],
  providers: [ComicChapterService],
  exports: [ComicChapterService],
})
export class ComicChapterModule {}
