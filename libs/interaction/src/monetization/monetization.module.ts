import { ContentPermissionModule } from '@libs/content/permission/content-permission.module'
import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { Module } from '@nestjs/common'
import { MonetizationService } from './monetization.service'

@Module({
  imports: [ContentPermissionModule, GrowthLedgerModule],
  providers: [MonetizationService],
  exports: [MonetizationService],
})
export class MonetizationModule {}
