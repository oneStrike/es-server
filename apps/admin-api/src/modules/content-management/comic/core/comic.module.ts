import { Module } from '@nestjs/common'
import { ComicController } from './comic.controller'
import { ComicService } from './comic.service'

/**
 * 漫画模块
 * 提供漫画管理的完整功能
 */
@Module({
  imports: [],
  controllers: [ComicController],
  providers: [ComicService],
  exports: [ComicService],
})
export class ComicModule {}
