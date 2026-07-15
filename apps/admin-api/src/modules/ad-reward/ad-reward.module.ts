import { ContentAdRewardPortModule } from '@libs/content/permission/content-ad-reward-port.module'
import { AdRewardModule as InteractionAdRewardModule } from '@libs/interaction/ad-reward/ad-reward.module'
import { Module } from '@nestjs/common'
import { AdRewardController } from './ad-reward.controller'

@Module({
  imports: [
    InteractionAdRewardModule.register({
      contentPortModule: ContentAdRewardPortModule,
    }),
  ],
  controllers: [AdRewardController],
})
export class AdminAdRewardModule {}
