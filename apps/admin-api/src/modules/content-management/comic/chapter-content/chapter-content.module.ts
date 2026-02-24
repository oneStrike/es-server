import { ContentModule } from '@libs/content/work/content'
import { Module } from '@nestjs/common'
import { ChapterContentController } from './chapter-content.controller'

@Module({
  imports: [ContentModule],
  controllers: [ChapterContentController],
  providers: [],
  exports: [ContentModule],
})
export class ChapterContentModule {}
