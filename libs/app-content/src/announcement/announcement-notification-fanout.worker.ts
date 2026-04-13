import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { AnnouncementNotificationFanoutService } from './announcement-notification-fanout.service'

@Injectable()
export class AnnouncementNotificationFanoutWorker {
  constructor(
    private readonly announcementNotificationFanoutService: AnnouncementNotificationFanoutService,
  ) {}

  @Cron('*/5 * * * * *')
  async consumePendingTasks() {
    await this.announcementNotificationFanoutService.consumePendingTasks()
  }
}
