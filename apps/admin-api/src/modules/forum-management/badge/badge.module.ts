import { ForumBadgeModule as ForumBadgeModuleLib } from '@libs/forum'
import { Module } from '@nestjs/common'
import { ForumBadgeController } from './badge.controller'

@Module({
  imports: [ForumBadgeModuleLib],
  controllers: [ForumBadgeController],
  providers: [],
  exports: [],
})
export class ForumBadgeModule {}
