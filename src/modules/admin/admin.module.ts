import { Module } from '@nestjs/common'
import { DictionaryController } from '@/modules/admin/dictionary/dictionary.controller'
import { AdminUploadModule } from '@/modules/admin/upload/upload.module'
import { SharedModule } from '../shared/shared.module'
import { AdminAuthModule } from './auth/auth.module'
import { FooModule } from './client/foo/foo.module'
import { ClientNoticeModule } from './client/notice'
import { ClientPageConfigModule } from './client/page'
import { RequestLogController } from './request-log'
import { AdminUserModule } from './user/user.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    AdminAuthModule,
    AdminUserModule,
    AdminUploadModule,
    SharedModule,
    ClientNoticeModule,
    ClientPageConfigModule,
    WorkModule,
    FooModule,
  ],
  controllers: [DictionaryController, RequestLogController],
  providers: [],
})
export class AdminModule {}
