import { ForumHashtagModule as ForumHashtagModuleLib } from '@libs/forum/hashtag/forum-hashtag.module'
import { Module } from '@nestjs/common'
import { ForumHashtagController } from './forum-hashtag.controller'

@Module({
  imports: [ForumHashtagModuleLib],
  controllers: [ForumHashtagController],
})
export class ForumHashtagModule {}
