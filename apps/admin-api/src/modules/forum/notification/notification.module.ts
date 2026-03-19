import { ForumNotificationModule as ForumNotificationModuleLib } from '@libs/forum'
import { Module } from '@nestjs/common'
import { ForumNotificationController } from './notification.controller'

@Module({
  imports: [ForumNotificationModuleLib],
  controllers: [ForumNotificationController],
})
export class NotificationModule {}
