import { ForumTagModule as ForumTagModuleLib } from '@libs/forum/tag'
import { Module } from '@nestjs/common'
import { ForumTagController } from './forum-tag.controller'

@Module({
  imports: [ForumTagModuleLib],
  controllers: [ForumTagController],
  providers: [],
  exports: [],
})
export class ForumTagModule {}
