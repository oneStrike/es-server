import { NotificationModule } from '@libs/forum/notification/notification.module'
import { Module } from '@nestjs/common'
import { ForumReplyController } from './forum-reply.controller'
import { ForumReplyService } from './forum-reply.service'

/**
 * 客户端论坛回复模块
 * 提供客户端论坛回复相关的功能
 */
@Module({
  imports: [NotificationModule],
  controllers: [ForumReplyController],
  providers: [ForumReplyService],
  exports: [ForumReplyService],
})
export class ForumReplyModule {}
