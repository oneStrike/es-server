import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { ClientNoticeModule } from './client/notice/notice.module'
import { ClientPageModule } from './client/page/page.module'
import { DictionaryController } from './dictionary/dictionary.controller'
import { AuditModule } from './system/audit/audit.module'
import { UploadModule } from './system/upload/upload.module'
import { AdminUserModule } from './user/user.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    AuthModule,
    AdminUserModule,
    UploadModule,
    ClientNoticeModule,
    ClientPageModule,
    WorkModule,
    AuditModule,
  ],
  controllers: [DictionaryController],
  providers: [],
})
export class AdminModule {}
