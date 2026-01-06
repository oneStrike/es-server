import { NotificationModule } from '@libs/forum'
import { Module } from '@nestjs/common'
import { AdminForumNotificationController } from './forum-notification.controller'

/**
 * 管理后台论坛通知模块
 * 提供管理后台论坛通知管理的功能
 */
@Module({
  imports: [NotificationModule],
  controllers: [AdminForumNotificationController],
  providers: [],
  exports: [],
})
export class AdminForumNotificationModule {}
