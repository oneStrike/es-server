import { UserGrowthEventModule } from '@libs/user/growth-event'
import { Module } from '@nestjs/common'
import { ComicService } from './comic.service'

/**
 * 漫画核心模块 Lib
 */
@Module({
  imports: [UserGrowthEventModule],
  providers: [ComicService],
  exports: [ComicService],
})
export class ComicCoreModule {}
