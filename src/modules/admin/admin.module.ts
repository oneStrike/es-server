import { Module } from '@nestjs/common'
import { DictionaryController } from '@/modules/admin/dictionary/dictionary.controller'
import { AdminUploadModule } from '@/modules/admin/upload/upload.module'
import { RequestLogModule } from '../shared/request-log/request-log.module'
import { SharedModule } from '../shared/shared.module'
import { AdminAuthModule } from './auth/auth.module'
import { ClientNoticeModule } from './client/notice'
import { ClientPageConfigModule } from './client/page'
import { RequestLogController } from './request-log/request-log.controller'
import { AdminUserModule } from './users/user.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    AdminAuthModule,
    AdminUserModule,
    AdminUploadModule,
    SharedModule,
    RequestLogModule,
    ClientNoticeModule,
    ClientPageConfigModule,
    WorkModule,
  ],
  controllers: [DictionaryController, RequestLogController],
  providers: [],
})
export class AdminModule {}
