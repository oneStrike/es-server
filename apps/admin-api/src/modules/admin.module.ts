import { Module } from '@nestjs/common'
import { AgreementModule } from './app-content/agreement/agreement.module'
import { AdminAnnouncementModule } from './app-content/announcement/announcement.module'
import { AppConfigModule } from './app-content/config/config.module'
import { AppPageModule } from './app-content/page/page.module'
import { AppUserModule } from './app-user/app-user.module'
import { AuthModule } from './auth/auth.module'
import { ContentModule } from './content-management/content.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { ForumManagementModule } from './forum-management/forum-management.module'
import { MessageModule } from './message/message.module'
import { SystemConfigModule } from './system/config/system-config.module'
import { UploadModule } from './system/upload/upload.module'
import { TaskModule } from './task/task.module'
import { UserGrowthModule } from './user-growth/user-growth.module'
import { UserModule } from './user/user.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    AuthModule,
    AppUserModule,
    UserModule,
    UploadModule,
    SystemConfigModule,
    AppPageModule,
    AppConfigModule,
    AgreementModule,
    DictionaryModule,
    AdminAnnouncementModule,
    ContentModule,
    ForumManagementModule,
    MessageModule,
    TaskModule,
    UserGrowthModule,
    WorkModule,
  ],
  controllers: [],
  providers: [],
})
export class AdminModule {}
