import { Module } from '@nestjs/common'
import { ComicService } from './comic.service'

/**
 * 漫画核心模块 Lib
 */
@Module({
  providers: [ComicService],
  exports: [ComicService],
})
export class ComicCoreModule {}
