import { Module } from '@nestjs/common'
import { ForumSectionModule } from './section/forum-section.module'
import { ForumTopicModule } from './topic/forum-topic.module'
import { ForumReplyModule } from './reply/forum-reply.module'
import { ClientForumNotificationModule } from './notification/forum-notification.module'
import { ForumSearchModule } from './search/forum-search.module'

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
