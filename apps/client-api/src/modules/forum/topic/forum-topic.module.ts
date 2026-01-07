import { NotificationModule } from '@libs/forum/notification/notification.module'
import { Module } from '@nestjs/common'
import { ForumTopicController } from './forum-topic.controller'
import { ForumTopicService } from './forum-topic.service'

/**
 * 客户端论坛主题模块
 * 提供客户端论坛主题相关的功能
 */
@Module({
  imports: [NotificationModule],
  controllers: [ForumTopicController],
  providers: [ForumTopicService],
  exports: [ForumTopicService],
})
export class ForumTopicModule {}
