/**
 * 浏览模块。
 *
 * 说明：
 * - 提供浏览记录功能
 * - 集成成长奖励、浏览统计等能力
 */
import { GrowthEventBridgeModule } from '@libs/growth/growth-reward'
import { Module } from '@nestjs/common'
import { BrowseLogGrowthService } from './browse-log-growth.service'
import { BrowseLogInteractionService } from './browse-log-interaction.service'
import { BrowseLogPermissionService } from './browse-log-permission.service'
import { BrowseLogService } from './browse-log.service'

@Module({
  imports: [GrowthEventBridgeModule],
  providers: [
    BrowseLogService,
    BrowseLogPermissionService,
    BrowseLogInteractionService,
    BrowseLogGrowthService,
  ],
  exports: [BrowseLogService],
})
export class BrowseLogModule {}
