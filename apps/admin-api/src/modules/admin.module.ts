import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { ClientNoticeModule } from './client/notice'
import { ClientPageModule } from './client/page'
import { DictionaryController } from './dictionary/dictionary.controller'
import { AuditModule } from './system/audit/audit.module'
import { AdminUploadModule } from './upload/upload.module'
import { AdminUserModule } from './user/user.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    AuthModule,
    AdminUserModule,
    AdminUploadModule,
    ClientNoticeModule,
    ClientPageModule,
    WorkModule,
    AuditModule,
  ],
  controllers: [DictionaryController],
  providers: [],
})
export class AdminModule {}
