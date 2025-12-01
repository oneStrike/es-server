import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { AdminClientNoticeModule } from './client-config/notice/notice.module'
import { AdminClientPageModule } from './client-config/page/page.module'
import { AdminDictionaryModule } from './dictionary/dictionary.module'
import { UploadModule } from './system/upload/upload.module'
import { UserModule } from './user/user.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    AuthModule,
    UserModule,
    UploadModule,
    WorkModule,
    AdminClientPageModule,
    AdminDictionaryModule,
    AdminClientNoticeModule,
  ],
  controllers: [],
  providers: [],
})
export class AdminModule {}
