import { Module } from '@nestjs/common'
import { AdminUserModule } from './admin-user/admin-user.module'
import { AgreementModule } from './app-content/agreement/agreement.module'
import { AdminAnnouncementModule } from './app-content/announcement/announcement.module'
import { AppConfigModule } from './app-content/config/config.module'
import { AppPageModule } from './app-content/page/page.module'
import { AppUserModule } from './app-user/app-user.module'
import { AuthModule } from './auth/auth.module'
import { ContentModule } from './content/content.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { ForumModule } from './forum/forum.module'
import { GrowthModule } from './growth/growth.module'
import { MessageModule } from './message/message.module'
import { SystemConfigModule } from './system/config/system-config.module'
import { UploadModule } from './system/upload/upload.module'
import { TaskModule } from './task/task.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    AuthModule,
    AppUserModule,
    AdminUserModule,
    UploadModule,
    SystemConfigModule,
    AppPageModule,
    AppConfigModule,
    AgreementModule,
    DictionaryModule,
    AdminAnnouncementModule,
    ContentModule,
    ForumModule,
    MessageModule,
    TaskModule,
    GrowthModule,
    WorkModule,
  ],
  controllers: [],
  providers: [],
})
export class AdminModule {}
