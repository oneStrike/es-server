import { DrizzleModule } from '@db/core'
import { AD_REWARD_CONTENT_PORT } from '@libs/interaction/ad-reward/ad-reward-content.port'
import { Module } from '@nestjs/common'
import { ContentAdRewardPortAdapter } from './content-ad-reward-port.adapter'
import { ContentPermissionModule } from './content-permission.module'

/** 内容域导出的广告奖励端口适配器模块。 */
@Module({
  imports: [DrizzleModule, ContentPermissionModule],
  providers: [
    ContentAdRewardPortAdapter,
    {
      provide: AD_REWARD_CONTENT_PORT,
      useExisting: ContentAdRewardPortAdapter,
    },
  ],
  exports: [AD_REWARD_CONTENT_PORT],
})
export class ContentAdRewardPortModule {}
