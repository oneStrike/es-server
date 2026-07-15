import type { MembershipModuleRegisterOptions } from './membership.module.type'
import { DrizzleModule } from '@db/core'
import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { DynamicModule, Module } from '@nestjs/common'
import { PaymentOrderModule } from '../payment/payment-order.module'
import { MembershipService } from './membership.service'

@Module({})
export class MembershipModule {
  // 组合根必须传入已配置的券 runtime，禁止依赖父/兄弟模块的隐式 provider 可见性。
  static register(options: MembershipModuleRegisterOptions): DynamicModule {
    return {
      module: MembershipModule,
      imports: [
        DrizzleModule,
        GrowthLedgerModule,
        PaymentOrderModule,
        options.couponRuntimeModule,
      ],
      providers: [MembershipService],
      exports: [MembershipService],
    }
  }
}
