import type { DynamicModule, Type } from '@nestjs/common'

/** 购买动态模块的显式应用层装配项。 */
export interface PurchaseModuleRegisterOptions {
  contentPortModule: Type<object> | DynamicModule
  couponRuntimeModule: Type<object> | DynamicModule
}
