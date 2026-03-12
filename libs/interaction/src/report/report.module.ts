/**
 * 举报模块
 *
 * 功能说明：
 * - 提供内容举报功能
 * - 通过解析器模式支持多种目标类型的举报操作
 * - 集成成长奖励能力
 *
 * 依赖模块：
 * - GrowthLedgerModule：成长账本模块，用于发放举报奖励
 */
import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { ReportGrowthService } from './report-growth.service'
import { ReportService } from './report.service'

@Module({
  imports: [GrowthLedgerModule],
  providers: [ReportService, ReportGrowthService],
  exports: [ReportService],
})
export class ReportModule {}
