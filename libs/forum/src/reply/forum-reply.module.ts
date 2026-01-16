import { Module } from '@nestjs/common'
import { ForumCounterModule } from '../counter/forum-counter.module'
import { ForumNotificationModule } from '../notification/notification.module'
import { ForumSensitiveWordModule } from '../sensitive-word/sensitive-word.module'
import { ForumReplyService } from './forum-reply.service'

/**
 * 论坛回复模块
 * 提供论坛回复管理的完整功能
 */
@Module({
  imports: [
    ForumNotificationModule,
    ForumSensitiveWordModule,
    ForumCounterModule,
  ],
  providers: [ForumReplyService],
  exports: [ForumReplyService],
})
export class ForumReplyModule {}
