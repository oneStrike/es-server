import { WorkChapterModule } from '@libs/content/work/chapter'
import { Module } from '@nestjs/common'
import { ComicChapterController } from './comic-chapter.controller'

@Module({
  imports: [WorkChapterModule],
  controllers: [ComicChapterController],
  providers: [],
  exports: [WorkChapterModule],
})
export class ComicChapterModule {}
