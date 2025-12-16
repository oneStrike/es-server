import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { ClientNoticeModule } from './client-config/notice/notice.module'
import { ClientPageModule } from './client-config/page/page.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { MemberModule } from './member-management/member.module'
import { UploadModule } from './system/upload/upload.module'
import { UserModule } from './user/user.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    AuthModule,
    UserModule,
    UploadModule,
    WorkModule,
    ClientPageModule,
    DictionaryModule,
    ClientNoticeModule,
    MemberModule,
  ],
  controllers: [],
  providers: [],
})
export class AdminModule {}
