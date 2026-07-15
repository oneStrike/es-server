import { PaymentModule as InteractionPaymentModule } from '@libs/interaction/payment/payment.module'
import { Module } from '@nestjs/common'
import { AppMembershipModule } from '../membership/membership.module'
import { PaymentController } from './payment.controller'

@Module({
  imports: [
    InteractionPaymentModule.register({
      membershipRuntimeModule: AppMembershipModule,
    }),
  ],
  controllers: [PaymentController],
})
export class AppPaymentModule {}
