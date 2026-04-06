import { GrowthEventBridgeModule } from '@libs/growth/growth-reward/growth-event-bridge.module';
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
