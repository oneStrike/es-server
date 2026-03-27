import { ForumSectionGroupModule as ForumSectionGroupModuleLib } from '@libs/forum/section-group'
import { Module } from '@nestjs/common'
import { ForumSectionGroupController } from './forum-section-group.controller'

@Module({
  imports: [ForumSectionGroupModuleLib],
  controllers: [ForumSectionGroupController],
  providers: [],
  exports: [],
})
export class ForumSectionGroupModule {}
