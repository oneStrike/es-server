import { MessageDomainEventModule } from '@libs/message/eventing/message-domain-event.module';
import { Module } from '@nestjs/common'
import { AnnouncementNotificationFanoutService } from './announcement-notification-fanout.service'
import { AnnouncementNotificationFanoutWorker } from './announcement-notification-fanout.worker'
import { AppAnnouncementService } from './announcement.service'

/**
 * 系统公告模块
 * 提供公告的管理功能
 */
@Module({
  imports: [MessageDomainEventModule],
  providers: [
    AnnouncementNotificationFanoutService,
    AnnouncementNotificationFanoutWorker,
    AppAnnouncementService,
  ],
  exports: [AppAnnouncementService],
})
export class AppAnnouncementModule {}
