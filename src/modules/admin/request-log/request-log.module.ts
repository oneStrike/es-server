import { Module } from '@nestjs/common'
import { RequestLogController } from './request-log.controller'
import { RequestLogService } from './request-log.service'

/**
 * 请求日志模块
 * 提供请求日志的管理功能
 */
@Module({
  providers: [RequestLogService],
  controllers: [RequestLogController],
  exports: [RequestLogService],
})
export class RequestLogModule {}
