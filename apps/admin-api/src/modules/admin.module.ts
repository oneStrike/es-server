import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { ClientNoticeModule } from './client/notice/notice.module'
import { ClientPageModule } from './client/page/page.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { AuditModule } from './system/audit/audit.module'
import { UploadModule } from './system/upload/upload.module'
import { UserModule } from './user/user.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    AuthModule,
    UserModule,
    UploadModule,
    ClientNoticeModule,
    ClientPageModule,
    WorkModule,
    AuditModule,
    DictionaryModule,
  ],
  controllers: [],
  providers: [],
})
export class AdminModule {}
