import { AppAnnouncementRuntimeModule } from '@libs/app-content/announcement/announcement-runtime.module'
import { AppAnnouncementModule } from '@libs/app-content/announcement/announcement.module'
import { Module } from '@nestjs/common'
import { AppAnnouncementController } from './announcement.controller'

@Module({
  imports: [AppAnnouncementModule, AppAnnouncementRuntimeModule],
  controllers: [AppAnnouncementController],
  providers: [],
})
export class AdminAnnouncementModule {}
