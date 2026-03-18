import { WorkModule } from '@libs/content'
import { Module } from '@nestjs/common'
import { ChapterContentController } from './chapter-content.controller'

@Module({
  imports: [WorkModule],
  controllers: [ChapterContentController],
  providers: [],
  exports: [],
})
export class ChapterContentModule {}
