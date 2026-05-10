import { PaymentModule as InteractionPaymentModule } from '@libs/interaction/payment/payment.module'
import { Module } from '@nestjs/common'
import { PaymentController } from './payment.controller'

@Module({
  imports: [InteractionPaymentModule],
  controllers: [PaymentController],
})
export class AdminPaymentModule {}
