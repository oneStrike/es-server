import { ContentPermissionModule } from '@libs/content/permission/content-permission.module';
import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module';
import { Module } from '@nestjs/common'
import { PurchaseService } from './purchase.service'

@Module({
  imports: [ContentPermissionModule, GrowthLedgerModule],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
