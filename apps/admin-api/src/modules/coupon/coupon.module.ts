import { Module } from '@nestjs/common'
import { AdminCouponRuntimeModule } from './coupon-runtime.module'
import { CouponController } from './coupon.controller'

@Module({
  imports: [AdminCouponRuntimeModule],
  controllers: [CouponController],
})
export class AdminCouponModule {}
