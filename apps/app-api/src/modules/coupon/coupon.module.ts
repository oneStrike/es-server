import { CouponModule as InteractionCouponModule } from '@libs/interaction/coupon/coupon.module'
import { Module } from '@nestjs/common'
import { CouponController } from './coupon.controller'

@Module({
  imports: [InteractionCouponModule],
  controllers: [CouponController],
})
export class AppCouponModule {}
