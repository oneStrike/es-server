import { Module } from '@nestjs/common'
import { DictionaryModule } from '@/modules/shared/dictionary/dictionary.module'

@Module({
  imports: [DictionaryModule],
  controllers: [],
  providers: [],
  exports: [DictionaryModule],
})
export class SharedModule {}
