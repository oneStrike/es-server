import { ContentModule } from '@libs/content'
import { Module } from '@nestjs/common'
import { ComicChapterController } from './comic-chapter.controller'

@Module({
  imports: [ContentModule],
  controllers: [ComicChapterController],
  providers: [],
  exports: [],
})
export class ComicChapterModule {}
