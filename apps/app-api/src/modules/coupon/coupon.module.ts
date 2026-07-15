import { Module } from '@nestjs/common'
import { AppCouponRuntimeModule } from './coupon-runtime.module'
import { CouponController } from './coupon.controller'

@Module({
  imports: [AppCouponRuntimeModule],
  controllers: [CouponController],
})
export class AppCouponModule {}
