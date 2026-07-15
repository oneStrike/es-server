import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { PaymentOrderService } from './payment-order.service'

@Module({
  imports: [DrizzleModule],
  providers: [PaymentOrderService],
  exports: [PaymentOrderService],
})
export class PaymentOrderModule {}
