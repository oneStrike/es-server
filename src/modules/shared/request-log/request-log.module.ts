import { Module } from '@nestjs/common'
import { RequestLogController } from '../../admin/request-log/request-log.controller'
import { RequestLogService } from './request-log.service'

/**
 * 请求日志模块
 * 提供系统请求日志的完整功能，包括日志记录、查询、统计等
 */
@Module({
  controllers: [RequestLogController],
  providers: [RequestLogService],
  exports: [RequestLogService], // 导出服务供其他模块使用
})
export class RequestLogModule {}
