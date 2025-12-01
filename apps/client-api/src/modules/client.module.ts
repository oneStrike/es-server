import { Module } from '@nestjs/common'
import { ClientNoticeModule } from './config/notice/notice.module'
import { ClientPageModule } from './config/page/page.module'
import { ClientDictionaryModule } from './dictionary/dictionary.module'

@Module({
  imports: [ClientDictionaryModule, ClientPageModule, ClientNoticeModule],
  controllers: [],
  providers: [],
})
export class ClientApiModule {}
