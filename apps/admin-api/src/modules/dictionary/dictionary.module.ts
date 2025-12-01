import { DictionaryModule } from '@libs/dictionary'
import { Module } from '@nestjs/common'
import { AdminDictionaryController } from './dictionary.controller'

@Module({
  imports: [DictionaryModule],
  controllers: [AdminDictionaryController],
  providers: [],
})
export class AdminDictionaryModule {}
