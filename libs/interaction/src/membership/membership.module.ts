import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { Module } from '@nestjs/common'
import { PaymentOrderModule } from '../payment/payment-order.module'
import { MembershipService } from './membership.service'

@Module({
  imports: [GrowthLedgerModule, PaymentOrderModule],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
