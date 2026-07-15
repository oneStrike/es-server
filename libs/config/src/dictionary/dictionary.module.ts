import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { LibDictionaryService } from './dictionary.service'

@Module({
  imports: [DrizzleModule],
  controllers: [],
  providers: [LibDictionaryService],
  exports: [LibDictionaryService],
})
export class LibDictionaryModule {}
