import { Module } from '@nestjs/common'
import { ComicModule } from './comic/comic.module'
import { ClientNoticeModule } from './config/notice/notice.module'
import { ClientPageModule } from './config/page/page.module'
import { DictionaryModule } from './dictionary/dictionary.module'

@Module({
  imports: [DictionaryModule, ClientPageModule, ClientNoticeModule, ComicModule],
  controllers: [],
  providers: [],
})
export class ClientApiModule {}
