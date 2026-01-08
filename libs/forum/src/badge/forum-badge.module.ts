import { Module } from '@nestjs/common'
import { ForumBadgeController } from './forum-badge.controller'
import { ForumBadgeService } from './forum-badge.service'

@Module({
  controllers: [ForumBadgeController],
  providers: [ForumBadgeService],
  exports: [ForumBadgeService],
})
export class ForumBadgeModule {}
