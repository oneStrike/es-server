import type { DynamicModule, Type } from '@nestjs/common'

/** 会员动态模块的显式券运行时装配项。 */
export interface MembershipModuleRegisterOptions {
  couponRuntimeModule: Type<object> | DynamicModule
}
