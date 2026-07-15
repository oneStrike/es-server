import type { PaymentModuleRegisterOptions } from './payment.module.type'
import { DrizzleModule } from '@db/core'
import { DynamicModule, Module } from '@nestjs/common'
import { WalletModule } from '../wallet/wallet.module'
import { PaymentNotifyService } from './payment-notify.service'
import { PaymentOrderReadService } from './payment-order-read.service'
import { PaymentOrderModule } from './payment-order.module'
import { PaymentProviderConfigService } from './payment-provider-config.service'
import { PaymentProviderRuntimeModule } from './payment-provider-runtime.module'
import { PaymentReconciliationService } from './payment-reconciliation.service'
import { PaymentSettlementService } from './payment-settlement.service'

@Module({})
export class PaymentModule {
  // 组合根必须传入已配置的会员 runtime，禁止依赖父/兄弟模块的隐式 provider 可见性。
  static register(options: PaymentModuleRegisterOptions): DynamicModule {
    return {
      module: PaymentModule,
      imports: [
        DrizzleModule,
        PaymentProviderRuntimeModule,
        PaymentOrderModule,
        WalletModule,
        options.membershipRuntimeModule,
      ],
      providers: [
        PaymentProviderConfigService,
        PaymentOrderReadService,
        PaymentSettlementService,
        PaymentReconciliationService,
        PaymentNotifyService,
      ],
      exports: [
        PaymentProviderConfigService,
        PaymentOrderReadService,
        PaymentReconciliationService,
        PaymentNotifyService,
      ],
    }
  }
}
