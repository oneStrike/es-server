import { Module } from '@nestjs/common'
import { DictionaryModule } from '@/modules/foundation/dictionary/dictionary.module'
import { RequestLogModule } from '@/modules/foundation/request-log'

@Module({
  imports: [DictionaryModule, RequestLogModule],
  controllers: [],
  providers: [],
  exports: [DictionaryModule, RequestLogModule],
})
export class FoundationModule {}
