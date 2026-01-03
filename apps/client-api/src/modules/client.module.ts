import { Module } from '@nestjs/common'
import { ClientNoticeModule } from './config/notice/notice.module'
import { ClientPageModule } from './config/page/page.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { ForumModule } from './forum/forum.module'

@Module({
  imports: [DictionaryModule, ClientPageModule, ClientNoticeModule, ForumModule],
  controllers: [],
  providers: [],
})
export class ClientApiModule {}
