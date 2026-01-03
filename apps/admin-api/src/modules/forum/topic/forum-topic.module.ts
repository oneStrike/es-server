import { Module } from '@nestjs/common'
import { ForumTopicController } from './forum-topic.controller'
import { ForumTopicService } from './forum-topic.service'

/**
 * 论坛主题模块
 * 提供论坛主题管理的完整功能
 */
@Module({
  imports: [],
  controllers: [ForumTopicController],
  providers: [ForumTopicService],
  exports: [ForumTopicService],
})
export class ForumTopicModule {}
