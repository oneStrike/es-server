import { Module } from '@nestjs/common'
import { AgreementModule } from './app-config/agreement/agreement.module'
import { AppConfigModule } from './app-config/config/config.module'
import { AppNoticeModule } from './app-config/notice/notice.module'
import { AppPageModule } from './app-config/page/page.module'
import { AuthModule } from './auth/auth.module'
import { ContentModule } from './content-management/content.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { ForumManagementModule } from './forum-management/forum-management.module'
import { SystemConfigModule } from './system/config/system-config.module'
import { UploadModule } from './system/upload/upload.module'
import { UserGrowthModule } from './user-growth/user-growth.module'
import { UserModule } from './user/user.module'

@Module({
  imports: [
    AuthModule,
    UserModule,
    UploadModule,
    SystemConfigModule,
    AppPageModule,
    AppConfigModule,
    AgreementModule,
    DictionaryModule,
    AppNoticeModule,
    ContentModule,
    ForumManagementModule,
    UserGrowthModule,
  ],
  controllers: [],
  providers: [],
})
export class AdminModule {}
