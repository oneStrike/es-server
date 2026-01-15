import { ForumTopicModule as ForumTopicModuleLib } from '@libs/forum/topic'
import { Module } from '@nestjs/common'
import { ForumTopicController } from './topic.controller'

@Module({
  imports: [ForumTopicModuleLib],
  controllers: [ForumTopicController],
  providers: [],
  exports: [],
})
export class ForumTopicModule {}
