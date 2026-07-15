import type { DynamicModule, Type } from '@nestjs/common'

/** 券动态模块的显式应用层装配项。 */
export interface CouponModuleRegisterOptions {
  contentPortModule: Type<object> | DynamicModule
}
