/**
 * 举报模块。
 *
 * 说明：
 * - 提供内容举报功能
 * - 集成成长奖励、目标解析等能力
 */
import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'
import { InteractionTargetResolverService } from '../interaction-target-resolver.service'
import { ReportService } from './report.service'

@Module({
  imports: [GrowthLedgerModule],
  providers: [
    InteractionTargetAccessService,
    InteractionTargetResolverService,
    ReportService,
  ],
  exports: [ReportService],
})
export class ReportModule {}
