import { Module } from '@nestjs/common'
import { AppAnnouncementService } from './announcement.service'

@Module({
  providers: [AppAnnouncementService],
  exports: [AppAnnouncementService],
})
export class AppAnnouncementModule {}
