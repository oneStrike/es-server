import { UserGrowthEventModule } from '@libs/user/growth-event'
import { Module } from '@nestjs/common'
import { ForumReportService } from './forum-report.service'

/**
 * 举报模块
 * 提供论坛举报管理的完整功能
 */
@Module({
  imports: [UserGrowthEventModule],
  providers: [ForumReportService],
  exports: [ForumReportService],
})
export class ForumReportModule {}
