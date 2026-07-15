import { PaymentModule as InteractionPaymentModule } from '@libs/interaction/payment/payment.module'
import { Module } from '@nestjs/common'
import { AdminMembershipModule } from '../membership/membership.module'
import { PaymentController } from './payment.controller'

@Module({
  imports: [
    InteractionPaymentModule.register({
      membershipRuntimeModule: AdminMembershipModule,
    }),
  ],
  controllers: [PaymentController],
})
export class AdminPaymentModule {}
