import { Module } from '@nestjs/common'
import { ForumViewController } from './forum-view.controller'
import { ForumViewService } from './forum-view.service'

@Module({
  controllers: [ForumViewController],
  providers: [ForumViewService],
  exports: [ForumViewService],
})
export class ForumViewModule {}
