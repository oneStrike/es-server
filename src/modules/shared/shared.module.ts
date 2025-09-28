import { Module } from '@nestjs/common'
import { DictionaryModule } from '@/modules/shared/dictionary/dictionary.module'
import { RequestLogModule } from '@/modules/shared/request-log'

@Module({
  imports: [DictionaryModule, RequestLogModule],
  controllers: [],
  providers: [],
  exports: [DictionaryModule, RequestLogModule],
})
export class SharedModule {}
