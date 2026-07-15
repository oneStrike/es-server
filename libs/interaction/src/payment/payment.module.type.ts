import type { DynamicModule, Type } from '@nestjs/common'

/** 支付动态模块的显式会员运行时装配项。 */
export interface PaymentModuleRegisterOptions {
  membershipRuntimeModule: Type<object> | DynamicModule
}
