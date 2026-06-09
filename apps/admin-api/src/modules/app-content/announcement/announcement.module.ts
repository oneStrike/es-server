import { AppAnnouncementRuntimeModule } from '@libs/app-content/announcement/announcement-runtime.module'
import { Module } from '@nestjs/common'
import { AppAnnouncementController } from './announcement.controller'

@Module({
  imports: [AppAnnouncementRuntimeModule],
  controllers: [AppAnnouncementController],
  providers: [],
})
export class AdminAnnouncementModule {}
