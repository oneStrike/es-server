import { ComicChapterModule } from '@libs/content/comic/chapter'
import { ComicChapterCommentModule } from '@libs/content/comic/chapter-comment'
import { ComicCoreModule } from '@libs/content/comic/core'
import { Module } from '@nestjs/common'
import { ComicController } from './comic.controller'

@Module({
  imports: [ComicCoreModule, ComicChapterModule, ComicChapterCommentModule],
  controllers: [ComicController],
})
export class ComicModule {}
