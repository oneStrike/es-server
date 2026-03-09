import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'
import { ViewGrowthService } from './view-growth.service'
import { ViewInteractionService } from './view-interaction.service'
import { ViewPermissionService } from './view-permission.service'
import { ViewService } from './view.service'

@Module({
  imports: [GrowthLedgerModule],
  providers: [
    InteractionTargetAccessService,
    ViewService,
    ViewPermissionService,
    ViewInteractionService,
    ViewGrowthService,
  ],
  exports: [ViewService],
})
export class ViewModule {}
