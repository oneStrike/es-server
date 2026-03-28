/**
 * 举报模块
 *
 * 功能说明：
 * - 提供内容举报功能
 * - 通过解析器模式支持多种目标类型的举报操作
 * - 集成裁决后的成长奖励能力
 *
 * 依赖模块：
 * - UserGrowthRewardModule：成长奖励模块，用于在裁决后发放奖励
 */
import { UserGrowthRewardModule } from '@libs/growth/growth-reward'
import { Module } from '@nestjs/common'
import { ReportGrowthService } from './report-growth.service'
import { ReportService } from './report.service'

@Module({
  imports: [UserGrowthRewardModule],
  providers: [ReportService, ReportGrowthService],
  exports: [ReportService],
})
export class ReportModule {}
