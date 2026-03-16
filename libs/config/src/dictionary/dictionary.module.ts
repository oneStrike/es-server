import { Module } from '@nestjs/common'
import { LibDictionaryService } from './dictionary.service'

@Module({
  controllers: [],
  providers: [LibDictionaryService],
  exports: [LibDictionaryService],
})
export class LibDictionaryModule {}
