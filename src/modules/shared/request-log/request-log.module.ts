import { Module } from '@nestjs/common'
import { GlobalModule } from '@/global/global.module'
import { RequestLogService } from './request-log.service'

@Module({
  imports: [GlobalModule],
  providers: [RequestLogService],
  exports: [RequestLogService],
})
export class RequestLogModule {}
