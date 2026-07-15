import { ContentCouponPortModule } from '@libs/content/permission/content-coupon-port.module'
import { CouponModule as InteractionCouponModule } from '@libs/interaction/coupon/coupon.module'
import { Module } from '@nestjs/common'

/** App API 内唯一的券运行时装配，供券、会员与购买模块共同消费。 */
@Module({
  imports: [
    InteractionCouponModule.register({
      contentPortModule: ContentCouponPortModule,
    }),
  ],
  exports: [InteractionCouponModule],
})
export class AppCouponRuntimeModule {}
