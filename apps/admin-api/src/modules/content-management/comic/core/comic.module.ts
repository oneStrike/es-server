import { ComicCoreModule as ComicCoreModuleLib } from '@libs/content/comic/core'
import { Module } from '@nestjs/common'
import { ComicController } from './comic.controller'

/**
 * 漫画模块
 * 提供漫画管理的完整功能
 */
@Module({
  imports: [ComicCoreModuleLib],
  controllers: [ComicController],
  providers: [],
  exports: [ComicCoreModuleLib],
})
export class ComicModule {}
