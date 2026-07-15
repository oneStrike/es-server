import type { AdRewardModuleRegisterOptions } from './ad-reward.module.type'
import { DrizzleModule } from '@db/core'
import { DynamicModule, Module } from '@nestjs/common'
import { AdRewardService } from './ad-reward.service'

/** 广告奖励模块必须由应用组合根显式绑定内容端口。 */
@Module({})
export class AdRewardModule {
  // 装配广告奖励事务 owner 与内容域端口，避免父模块 provider 的隐式可见性。
  static register(options: AdRewardModuleRegisterOptions): DynamicModule {
    return {
      module: AdRewardModule,
      imports: [DrizzleModule, options.contentPortModule],
      providers: [AdRewardService],
      exports: [AdRewardService],
    }
  }
}
