import { ReadingStateModule } from '@libs/interaction/reading-state/reading-state.module';
import { Module } from '@nestjs/common'
import { ReadingHistoryController } from './reading-history.controller'

@Module({
  imports: [ReadingStateModule],
  controllers: [ReadingHistoryController],
})
export class ReadingHistoryModule {}
