import { Module } from '@nestjs/common'
import { ForumBadgeService } from './forum-badge.service'

@Module({
  controllers: [],
  providers: [ForumBadgeService],
  exports: [ForumBadgeService],
})
export class ForumBadgeModule {}
