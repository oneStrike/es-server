import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { ClientNoticeModule } from './client-config/notice/notice.module'
import { ClientPageModule } from './client-config/page/page.module'
import { ContentModule } from './content-management/content.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { ForumManagementModule } from './forum-management/forum-management.module'
import { MemberModule } from './member-management/member.module'
import { UploadModule } from './system/upload/upload.module'
import { UserModule } from './user/user.module'

@Module({
  imports: [
    AuthModule,
    UserModule,
    UploadModule,
    ClientPageModule,
    DictionaryModule,
    ClientNoticeModule,
    MemberModule,
    ContentModule,
    ForumManagementModule,
  ],
  controllers: [],
  providers: [],
})
export class AdminModule {}
