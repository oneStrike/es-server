import { Module } from '@nestjs/common'
import { ForumSectionGroupService } from './forum-section-group.service'

@Module({
  controllers: [],
  providers: [ForumSectionGroupService],
  exports: [ForumSectionGroupService],
})
export class ForumSectionGroupModule {}
