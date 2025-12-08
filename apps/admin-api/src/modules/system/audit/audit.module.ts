import { Global, Module } from '@nestjs/common'
import { AuditController } from './audit.controller'
import { AuditService } from './audit.service'

/**
 * 请求日志模块
 * 提供系统请求日志的完整功能，包括日志记录、查询、统计等
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService], // 导出服务供其他模块使用
})
export class AuditModule {}
