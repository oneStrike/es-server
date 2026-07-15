import type { DynamicModule, Type } from '@nestjs/common'

/**
 * 广告奖励动态模块的显式装配项。
 * contentPortModule 必须导出 AD_REWARD_CONTENT_PORT，供同一动态模块中的服务注入。
 */
export interface AdRewardModuleRegisterOptions {
  contentPortModule: Type<object> | DynamicModule
}
