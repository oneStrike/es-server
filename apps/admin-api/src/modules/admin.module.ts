import { GeoModule } from '@libs/platform/modules/geo/geo.module'
import { Module } from '@nestjs/common'
import { AdminUserModule } from './admin-user/admin-user.module'
import { AgreementModule } from './app-content/agreement/agreement.module'
import { AdminAnnouncementModule } from './app-content/announcement/announcement.module'
import { AppConfigModule } from './app-content/config/config.module'
import { AppPageModule } from './app-content/page/page.module'
import { AppUpdateModule } from './app-content/update/update.module'
import { AppUserModule } from './app-user/app-user.module'
import { AuthModule } from './auth/auth.module'
import { CheckInModule } from './check-in/check-in.module'
import { AdminCommentModule } from './comment/comment.module'
import { ContentModule } from './content/content.module'
import { ForumModule } from './forum/forum.module'
import { GrowthModule } from './growth/growth.module'
import { MessageModule } from './message/message.module'
import { AdminReportModule } from './report/report.module'
import { SystemConfigModule } from './system/config/system-config.module'
import { DictionaryModule } from './system/dictionary/dictionary.module'
import { Ip2regionModule } from './system/ip2region/ip2region.module'
import { UploadModule } from './system/upload/upload.module'
import { TaskModule } from './task/task.module'

@Module({
  imports: [
    GeoModule,
    AuthModule,
    AppUserModule,
    CheckInModule,
    AdminUserModule,
    UploadModule,
    Ip2regionModule,
    SystemConfigModule,
    AppPageModule,
    AppConfigModule,
    AppUpdateModule,
    AgreementModule,
    DictionaryModule,
    AdminAnnouncementModule,
    ContentModule,
    AdminCommentModule,
    ForumModule,
    AdminReportModule,
    MessageModule,
    TaskModule,
    GrowthModule,
  ],
  controllers: [],
  providers: [],
})
export class AdminModule {}
