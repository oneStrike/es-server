import { Module } from '@nestjs/common'
import { ForumReportController } from './forum-report.controller'
import { ForumReportService } from './forum-report.service'

/**
 * 举报模块
 * 提供论坛举报管理的完整功能
 */
@Module({
  controllers: [ForumReportController],
  providers: [ForumReportService],
  exports: [ForumReportService],
})
export class ForumReportModule {}
