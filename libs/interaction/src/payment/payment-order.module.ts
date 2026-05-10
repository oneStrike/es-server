import { Module } from '@nestjs/common'
import { PaymentOrderService } from './payment-order.service'

@Module({ providers: [PaymentOrderService], exports: [PaymentOrderService] })
export class PaymentOrderModule {}
