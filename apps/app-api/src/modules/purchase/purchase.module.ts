import { ContentPurchasePortModule } from '@libs/content/permission/content-purchase-port.module'
import { PurchaseModule as PurchaseCoreModule } from '@libs/interaction/purchase/purchase.module'
import { Module } from '@nestjs/common'
import { AppCouponRuntimeModule } from '../coupon/coupon-runtime.module'
import { PurchaseController } from './purchase.controller'

@Module({
  imports: [
    PurchaseCoreModule.register({
      contentPortModule: ContentPurchasePortModule,
      couponRuntimeModule: AppCouponRuntimeModule,
    }),
  ],
  controllers: [PurchaseController],
})
export class PurchaseModule {}
