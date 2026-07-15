import { DrizzleModule } from '@db/core'
import { GeoModule } from '@libs/platform/modules/geo/geo.module'
import { Module } from '@nestjs/common'
import { AuditService } from './audit.service'

/**
 * 审计日志模块。
 *
 * 审计拦截器和管理端查询共享同一 owner provider，保证请求日志写入语义一致。
 */
@Module({
  imports: [DrizzleModule, GeoModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class ObservabilityAuditModule {}
