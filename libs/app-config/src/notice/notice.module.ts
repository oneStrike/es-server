import { Module } from '@nestjs/common'
import { LibAppNoticeService } from './notice.service'

@Module({
  controllers: [],
  providers: [LibAppNoticeService],
  exports: [LibAppNoticeService],
})
export class LibAppNoticeModule {}
