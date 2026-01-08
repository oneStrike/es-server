import { Module } from '@nestjs/common'
import { ForumAuditLogService } from './forum-audit-log.service'

/**
 * 论坛审核日志模块
 * 提供审核日志的管理功能
 */
@Module({
  controllers: [],
  providers: [ForumAuditLogService],
  exports: [ForumAuditLogService],
})
export class ForumAuditLogModule {}
