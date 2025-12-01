import { LibsDictionaryModule } from '@libs/dictionary'
import { Module } from '@nestjs/common'
import { DictionaryController } from './dictionary.controller'

@Module({
  imports: [LibsDictionaryModule],
  controllers: [DictionaryController],
  providers: [],
})
export class DictionaryModule {}
