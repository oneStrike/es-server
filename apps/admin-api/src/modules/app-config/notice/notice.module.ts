import { LibAppNoticeModule } from '@libs/app-config/notice'
import { Module } from '@nestjs/common'
import { AppNoticeController } from './notice.controller'

@Module({
  imports: [LibAppNoticeModule],
  controllers: [AppNoticeController],
  providers: [],
  exports: [],
})
export class AppNoticeModule {}
