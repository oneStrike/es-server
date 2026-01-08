import { Module } from '@nestjs/common'
import { ForumAuditLogController } from './forum-audit-log.controller'
import { ForumAuditLogService } from './forum-audit-log.service'

@Module({
  controllers: [ForumAuditLogController],
  providers: [ForumAuditLogService],
  exports: [ForumAuditLogService],
})
export class ForumAuditLogModule {}
