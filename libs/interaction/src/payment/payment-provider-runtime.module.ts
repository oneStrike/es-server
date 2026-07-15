import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { PaymentProviderRuntimeService } from './payment-provider-runtime.service'

/** 支付 provider 适配器、不可变配置版本与凭据材料的唯一 Runtime owner。 */
@Module({
  imports: [DrizzleModule],
  providers: [PaymentProviderRuntimeService],
  exports: [PaymentProviderRuntimeService],
})
export class PaymentProviderRuntimeModule {}
