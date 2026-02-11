import { ComicChapterModule } from '@libs/content/comic/chapter'
import { ComicCoreModule } from '@libs/content/comic/core'
import { Module } from '@nestjs/common'
import { ComicController } from './comic.controller'

@Module({
  imports: [ComicCoreModule, ComicChapterModule],
  controllers: [ComicController],
})
export class ComicModule {}
