import { NotificationModule } from '@libs/forum/notification/notification.module'
import { Module } from '@nestjs/common'
import { ClientForumNotificationController } from './forum-notification.controller'

/**
 * 客户端论坛通知模块
 * 提供客户端论坛通知管理的功能
 */
@Module({
  imports: [NotificationModule],
  controllers: [ClientForumNotificationController],
  providers: [],
  exports: [],
})
export class ClientForumNotificationModule {}
