import { Module } from '@nestjs/common'
import { MembershipModule } from '../membership/membership.module'
import { WalletModule } from '../wallet/wallet.module'
import { PaymentOrderModule } from './payment-order.module'
import { PaymentService } from './payment.service'

@Module({
  imports: [PaymentOrderModule, WalletModule, MembershipModule],
  providers: [PaymentService],
  exports: [PaymentService, PaymentOrderModule],
})
export class PaymentModule {}
