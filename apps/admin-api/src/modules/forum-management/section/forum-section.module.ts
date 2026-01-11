import { ForumSectionModule as ForumSectionModuleLib } from '@libs/forum'
import { Module } from '@nestjs/common'
import { ForumSectionController } from './forum-section.controller'

@Module({
  imports: [ForumSectionModuleLib],
  controllers: [ForumSectionController],
  providers: [],
  exports: [],
})
export class ForumSectionModule {}
