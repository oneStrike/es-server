import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { PaymentOrderService } from './payment-order.service'
import { PaymentProviderRuntimeModule } from './payment-provider-runtime.module'

@Module({
  imports: [DrizzleModule, PaymentProviderRuntimeModule],
  providers: [PaymentOrderService],
  exports: [PaymentOrderService],
})
export class PaymentOrderModule {}
