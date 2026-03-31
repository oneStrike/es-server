/**
 * 举报模块
 *
 * 功能说明：
 * - 提供内容举报功能
 * - 通过解析器模式支持多种目标类型的举报操作
 * - 集成裁决后的成长奖励能力
 *
 * 依赖模块：
 * - GrowthEventBridgeModule：成长事件桥接模块，用于统一派发举报裁决事件
 */
import { GrowthEventBridgeModule } from '@libs/growth/growth-reward'
import { Module } from '@nestjs/common'
import { ReportGrowthService } from './report-growth.service'
import { ReportService } from './report.service'

@Module({
  imports: [GrowthEventBridgeModule],
  providers: [ReportService, ReportGrowthService],
  exports: [ReportService],
})
export class ReportModule {}
