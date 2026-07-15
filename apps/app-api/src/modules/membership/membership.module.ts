import { MembershipModule as InteractionMembershipModule } from '@libs/interaction/membership/membership.module'
import { Module } from '@nestjs/common'
import { AppCouponRuntimeModule } from '../coupon/coupon-runtime.module'
import { MembershipController } from './membership.controller'

@Module({
  imports: [
    InteractionMembershipModule.register({
      couponRuntimeModule: AppCouponRuntimeModule,
    }),
  ],
  controllers: [MembershipController],
  exports: [InteractionMembershipModule],
})
export class AppMembershipModule {}
