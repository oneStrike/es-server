import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { ReadingStateService } from './reading-state.service'

@Module({
  imports: [DrizzleModule],
  providers: [ReadingStateService],
  exports: [ReadingStateService],
})
export class ReadingStateModule {}
