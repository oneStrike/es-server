import { ContentPermissionModule } from '@libs/content/permission'
import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { PurchaseService } from './purchase.service'

@Module({
  imports: [ContentPermissionModule, GrowthLedgerModule],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
