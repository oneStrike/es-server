import { ContentPermissionModule } from '@libs/content/permission/content-permission.module'
import { WorkCounterModule } from '@libs/content/work-counter/work-counter.module'
import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { Module } from '@nestjs/common'
import { MonetizationModule } from '../monetization/monetization.module'
import { PurchaseService } from './purchase.service'

@Module({
  imports: [
    ContentPermissionModule,
    GrowthLedgerModule,
    WorkCounterModule,
    MonetizationModule,
  ],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
