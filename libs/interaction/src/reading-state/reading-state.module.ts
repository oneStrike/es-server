import { Module } from '@nestjs/common'
import { ReadingStateService } from './reading-state.service'

@Module({
  providers: [ReadingStateService],
  exports: [ReadingStateService],
})
export class ReadingStateModule {}
