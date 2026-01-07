import { Module } from '@nestjs/common'
import { ForumTagService } from './forum-tag.service'

@Module({
  controllers: [],
  providers: [ForumTagService],
  exports: [ForumTagService],
})
export class ForumTagModule {}
