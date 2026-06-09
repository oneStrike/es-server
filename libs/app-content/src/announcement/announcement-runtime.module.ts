import { MessageDomainEventModule } from '@libs/message/eventing/message-domain-event.module'
import { Module } from '@nestjs/common'
import { ANNOUNCEMENT_FANOUT_PORT } from './announcement-fanout.port'
import { AnnouncementNotificationFanoutService } from './announcement-notification-fanout.service'
import { AnnouncementNotificationFanoutWorker } from './announcement-notification-fanout.worker'
import { AppAnnouncementService } from './announcement.service'

@Module({
  imports: [MessageDomainEventModule],
  providers: [
    AnnouncementNotificationFanoutService,
    {
      provide: ANNOUNCEMENT_FANOUT_PORT,
      useExisting: AnnouncementNotificationFanoutService,
    },
    AnnouncementNotificationFanoutWorker,
    AppAnnouncementService,
  ],
  exports: [AnnouncementNotificationFanoutService, AppAnnouncementService],
})
export class AppAnnouncementRuntimeModule {}
