import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { Module } from '@nestjs/common'
import { PaymentOrderModule } from '../payment/payment-order.module'
import { WalletService } from './wallet.service'

@Module({
  imports: [GrowthLedgerModule, PaymentOrderModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
