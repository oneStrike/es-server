import { Module } from '@nestjs/common'
import { AgreementModule } from './app-config/agreement/agreement.module'
import { AppConfigModule } from './app-config/config/config.module'
import { AppNoticeModule } from './app-config/notice/notice.module'
import { AppPageModule } from './app-config/page/page.module'
import { AuthModule } from './auth/auth.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { TaskModule } from './task/task.module'
import { UserModule } from './user/user.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    AuthModule,
    UserModule,
    DictionaryModule,
    AppNoticeModule,
    AppPageModule,
    AppConfigModule,
    AgreementModule,
    TaskModule,
    WorkModule,
  ],
})
export class AppApiModule {}
