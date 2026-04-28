import { ForumModeratorModule as ForumModeratorModuleLib } from '@libs/forum/moderator/moderator.module'
import { ForumTopicModule as ForumTopicModuleLib } from '@libs/forum/topic/forum-topic.module';
import { Module } from '@nestjs/common'
import { ForumTopicController } from './topic.controller'

@Module({
  imports: [ForumModeratorModuleLib, ForumTopicModuleLib],
  controllers: [ForumTopicController],
  providers: [],
  exports: [],
})
export class ForumTopicModule {}
