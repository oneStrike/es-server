import { Module } from '@nestjs/common'
import { AppConfigModule } from './app-config/config/config.module'
import { AppNoticeModule } from './app-config/notice/notice.module'
import { AppPageModule } from './app-config/page/page.module'
import { AuthModule } from './auth/auth.module'
import { ContentModule } from './content-management/content.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { ForumManagementModule } from './forum-management/forum-management.module'
import { UploadModule } from './system/upload/upload.module'
import { UserModule } from './user/user.module'

@Module({
  imports: [
    AuthModule,
    UserModule,
    UploadModule,
    AppPageModule,
    AppConfigModule,
    DictionaryModule,
    AppNoticeModule,
    ContentModule,
    ForumManagementModule,
  ],
  controllers: [],
  providers: [],
})
export class AdminModule {}
