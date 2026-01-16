import { Module } from '@nestjs/common'
import { AppNoticeModule } from './app-config/notice/notice.module'
import { AppPageModule } from './app-config/page/page.module'
import { DictionaryModule } from './dictionary/dictionary.module'

@Module({
  imports: [DictionaryModule, AppPageModule, AppNoticeModule],
  controllers: [],
  providers: [],
})
export class AppApiModule {}
