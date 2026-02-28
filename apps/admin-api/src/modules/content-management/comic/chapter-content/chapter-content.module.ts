import { ContentModule } from '@libs/content'
import { Module } from '@nestjs/common'
import { ChapterContentController } from './chapter-content.controller'

@Module({
  imports: [ContentModule],
  controllers: [ChapterContentController],
  providers: [],
  exports: [],
})
export class ChapterContentModule {}
