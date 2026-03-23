import { AppAnnouncementModule } from '@libs/app-content/announcement'
import { Module } from '@nestjs/common'
import { AppAnnouncementController } from './announcement.controller'

@Module({
  imports: [AppAnnouncementModule],
  controllers: [AppAnnouncementController],
  providers: [],
})
export class AdminAnnouncementModule {}
