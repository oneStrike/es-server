import type { PurchaseModuleRegisterOptions } from './purchase.module.type'
import { DrizzleModule } from '@db/core'
import { UserLevelRuleModule } from '@libs/growth/level-rule/level-rule.module'
import { DynamicModule, Module } from '@nestjs/common'
import { WalletModule } from '../wallet/wallet.module'
import { PurchaseService } from './purchase.service'

/** 购买模块必须由应用组合根显式绑定内容端口和已配置的券运行时模块。 */
@Module({})
export class PurchaseModule {
  // 装配购买事务 owner、内容端口和共享的券 provider。
  static register(options: PurchaseModuleRegisterOptions): DynamicModule {
    return {
      module: PurchaseModule,
      imports: [
        DrizzleModule,
        UserLevelRuleModule,
        options.couponRuntimeModule,
        WalletModule,
        options.contentPortModule,
      ],
      providers: [PurchaseService],
      exports: [PurchaseService],
    }
  }
}
