import { ContentCouponPortModule } from '@libs/content/permission/content-coupon-port.module'
import { CouponModule as InteractionCouponModule } from '@libs/interaction/coupon/coupon.module'
import { Module } from '@nestjs/common'

/** Admin API 内唯一的券运行时装配，供券与会员模块共同消费。 */
@Module({
  imports: [
    InteractionCouponModule.register({
      contentPortModule: ContentCouponPortModule,
    }),
  ],
  exports: [InteractionCouponModule],
})
export class AdminCouponRuntimeModule {}
