import { UserGrowthRewardModule } from '@libs/user/growth-reward'
import { Module } from '@nestjs/common'
import { ForumReportService } from './forum-report.service'

/**
 * 举报模块
 * 提供论坛举报管理的完整功能
 */
@Module({
  imports: [UserGrowthRewardModule],
  providers: [ForumReportService],
  exports: [ForumReportService],
})
export class ForumReportModule {}
