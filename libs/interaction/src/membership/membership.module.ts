import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { Module } from '@nestjs/common'
import { CouponModule } from '../coupon/coupon.module'
import { PaymentOrderModule } from '../payment/payment-order.module'
import { MembershipService } from './membership.service'

@Module({
  imports: [GrowthLedgerModule, PaymentOrderModule, CouponModule],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
