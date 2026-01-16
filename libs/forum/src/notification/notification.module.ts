import { Module } from '@nestjs/common'
import { ForumNotificationService } from './notification.service'

/**
 * 通知模块
 * 提供论坛通知管理的完整功能
 */
@Module({
  imports: [],
  providers: [ForumNotificationService],
  exports: [ForumNotificationService],
})
export class ForumNotificationModule {}
