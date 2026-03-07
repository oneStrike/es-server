import { Module } from '@nestjs/common'
import { MessageNotificationService } from './notification.service'

/**
 * 消息通知模块
 * 提供用户通知的查询、标记已读等功能
 */
@Module({
  providers: [MessageNotificationService],
  exports: [MessageNotificationService],
})
export class MessageNotificationModule {}
