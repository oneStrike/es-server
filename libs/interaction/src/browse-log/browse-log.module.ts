/**
 * 浏览模块。
 *
 * 说明：
 * - 提供浏览记录功能
 * - 集成成长奖励、浏览统计等能力
 */
import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'
import { BrowseLogGrowthService } from './browse-log-growth.service'
import { BrowseLogInteractionService } from './browse-log-interaction.service'
import { BrowseLogPermissionService } from './browse-log-permission.service'
import { BrowseLogService } from './browse-log.service'

@Module({
  imports: [GrowthLedgerModule],
  providers: [
    InteractionTargetAccessService,
    BrowseLogService,
    BrowseLogPermissionService,
    BrowseLogInteractionService,
    BrowseLogGrowthService,
  ],
  exports: [BrowseLogService],
})
export class BrowseLogModule {}
