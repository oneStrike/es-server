import { MembershipModule as InteractionMembershipModule } from '@libs/interaction/membership/membership.module'
import { Module } from '@nestjs/common'
import { AdminCouponRuntimeModule } from '../coupon/coupon-runtime.module'
import { MembershipController } from './membership.controller'

@Module({
  imports: [
    InteractionMembershipModule.register({
      couponRuntimeModule: AdminCouponRuntimeModule,
    }),
  ],
  controllers: [MembershipController],
  exports: [InteractionMembershipModule],
})
export class AdminMembershipModule {}
