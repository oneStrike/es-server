import { Module } from '@nestjs/common'
import { ClientForumNotificationModule } from './notification/forum-notification.module'
import { ForumReplyModule } from './reply/forum-reply.module'
import { ForumSearchModule } from './search/forum-search.module'
import { ForumSectionModule } from './section/forum-section.module'
import { ForumTopicModule } from './topic/forum-topic.module'

/**
 * 客户端论坛模块
 * 提供客户端论坛相关的功能
 */
@Module({
  imports: [
    ForumSectionModule,
    ForumTopicModule,
    ForumReplyModule,
    ClientForumNotificationModule,
    ForumSearchModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class ForumModule {}
