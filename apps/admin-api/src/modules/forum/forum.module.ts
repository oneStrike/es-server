import { Module } from '@nestjs/common'
import { AdminForumNotificationModule } from './notification/forum-notification.module'
import { ForumReplyModule } from './reply/forum-reply.module'
import { ForumSectionModule } from './section/forum-section.module'
import { ForumTopicModule } from './topic/forum-topic.module'
import { ForumUserModule } from './user/forum-user.module'

/**
 * 论坛模块
 * 提供论坛管理的完整功能
 */
@Module({
  imports: [
    ForumUserModule,
    ForumSectionModule,
    ForumTopicModule,
    ForumReplyModule,
    AdminForumNotificationModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class ForumModule {}
