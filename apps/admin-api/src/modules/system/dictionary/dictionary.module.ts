import { LibDictionaryModule } from '@libs/dictionary/dictionary.module';
import { Module } from '@nestjs/common'
import { DictionaryController } from './dictionary.controller'

@Module({
  imports: [LibDictionaryModule],
  controllers: [DictionaryController],
  providers: [],
})
export class DictionaryModule {}
