import { Module } from '@nestjs/common'
import { AgreementModule } from './app-config/agreement/agreement.module'
import { AppConfigModule } from './app-config/config/config.module'
import { AppNoticeModule } from './app-config/notice/notice.module'
import { AppPageModule } from './app-config/page/page.module'
import { AuthModule } from './auth/auth.module'
import { ComicModule } from './comic/comic.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { NovelModule } from './novel/novel.module'
import { TaskModule } from './task/task.module'
import { UserModule } from './user/user.module'

@Module({
  imports: [
    AuthModule,
    UserModule,
    DictionaryModule,
    AppNoticeModule,
    AppPageModule,
    AppConfigModule,
    AgreementModule,
    ComicModule,
    TaskModule,
    NovelModule
  ],
})
export class AppApiModule { }
