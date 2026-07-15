import { DrizzleModule } from '@db/core'
import { EventingModule } from '@libs/eventing/eventing/eventing.module'
import { Module } from '@nestjs/common'
import { ANNOUNCEMENT_FANOUT_PORT } from './announcement-fanout.port'
import { AnnouncementNotificationFanoutService } from './announcement-notification-fanout.service'
import { AnnouncementNotificationFanoutWorker } from './announcement-notification-fanout.worker'
import { AppAnnouncementModule } from './announcement.module'

@Module({
  imports: [DrizzleModule, AppAnnouncementModule, EventingModule],
  providers: [
    AnnouncementNotificationFanoutService,
    {
      provide: ANNOUNCEMENT_FANOUT_PORT,
      useExisting: AnnouncementNotificationFanoutService,
    },
    AnnouncementNotificationFanoutWorker,
  ],
  exports: [AnnouncementNotificationFanoutService],
})
export class AppAnnouncementRuntimeModule {}
