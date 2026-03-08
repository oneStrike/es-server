import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { ViewGrowthService } from './view-growth.service'
import { ViewInteractionService } from './view-interaction.service'
import { ViewPermissionService } from './view-permission.service'
import { ViewService } from './view.service'

@Module({
  imports: [GrowthLedgerModule],
  providers: [
    ViewService,
    ViewPermissionService,
    ViewInteractionService,
    ViewGrowthService,
  ],
  exports: [ViewService],
})
export class ViewModule {}
