import { Module } from '@nestjs/common'
import { NotificationModule } from '../notification/notification.module'
import { ForumReplyController } from './forum-reply.controller'
import { ForumReplyService } from './forum-reply.service'

/**
 * 论坛回复模块
 * 提供论坛回复管理的完整功能
 */
@Module({
  imports: [NotificationModule],
  controllers: [ForumReplyController],
  providers: [ForumReplyService],
  exports: [ForumReplyService],
})
export class ForumReplyModule {}
