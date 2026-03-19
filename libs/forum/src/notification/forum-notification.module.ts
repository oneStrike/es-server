import { Module } from '@nestjs/common'
import { ForumNotificationService } from './forum-notification.service'

/**
 * 论坛通知模块。
 */
@Module({
  providers: [ForumNotificationService],
  exports: [ForumNotificationService],
})
export class ForumNotificationModule {}
