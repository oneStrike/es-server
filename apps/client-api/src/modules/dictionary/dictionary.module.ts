import { DictionaryModule } from '@libs/dictionary'
import { Module } from '@nestjs/common'
import { ClientDictionaryController } from './dictionary.controller'

@Module({
  imports: [DictionaryModule],
  controllers: [ClientDictionaryController],
  providers: [],
})
export class ClientDictionaryModule {}
