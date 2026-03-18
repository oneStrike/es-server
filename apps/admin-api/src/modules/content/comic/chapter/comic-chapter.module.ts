import { WorkModule } from '@libs/content'
import { Module } from '@nestjs/common'
import { ComicChapterController } from './comic-chapter.controller'

@Module({
  imports: [WorkModule],
  controllers: [ComicChapterController],
  providers: [],
  exports: [],
})
export class ComicChapterModule {}
