import { ContentPermissionModule } from '@libs/content/permission/content-permission.module'
import { Module } from '@nestjs/common'
import { AdRewardService } from './ad-reward.service'

@Module({
  imports: [ContentPermissionModule],
  providers: [AdRewardService],
  exports: [AdRewardService],
})
export class AdRewardModule {}
