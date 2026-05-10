import { ContentPermissionModule } from '@libs/content/permission/content-permission.module'
import { WorkCounterModule } from '@libs/content/work-counter/work-counter.module'
import { Module } from '@nestjs/common'
import { CouponModule } from '../coupon/coupon.module'
import { WalletModule } from '../wallet/wallet.module'
import { PurchaseService } from './purchase.service'

@Module({
  imports: [
    ContentPermissionModule,
    WorkCounterModule,
    CouponModule,
    WalletModule,
  ],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
