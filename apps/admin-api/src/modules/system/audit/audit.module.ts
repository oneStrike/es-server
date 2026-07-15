import { ObservabilityAuditModule } from '@libs/observability/audit/audit.module'
import { Module } from '@nestjs/common'
import { AuditController } from './audit.controller'

/**
 * 请求日志模块
 * 提供系统请求日志的完整功能，包括日志记录、查询、统计等
 */
@Module({
  imports: [ObservabilityAuditModule],
  controllers: [AuditController],
})
export class AuditModule {}
