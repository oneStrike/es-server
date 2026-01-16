import { Module } from '@nestjs/common'
import { AppNoticeModule } from './app-config/notice/notice.module'
import { AppPageModule } from './app-config/page/page.module'
import { AuthModule } from './auth/auth.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { UserModule } from './user/user.module'

@Module({
  imports: [
    AuthModule,
    UserModule,
    DictionaryModule,
    AppNoticeModule,
    AppPageModule,
  ],
})
export class AppApiModule {}
