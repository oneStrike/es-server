import { PaymentModule as InteractionPaymentModule } from '@libs/interaction/payment/payment.module'
import { Module } from '@nestjs/common'
import { AppMembershipModule } from '../membership/membership.module'
import { PaymentProviderNotifyController } from './payment-provider-notify.controller'
import { PaymentController } from './payment.controller'

@Module({
  imports: [
    InteractionPaymentModule.register({
      membershipRuntimeModule: AppMembershipModule,
    }),
  ],
  controllers: [PaymentController, PaymentProviderNotifyController],
})
export class AppPaymentModule {}
