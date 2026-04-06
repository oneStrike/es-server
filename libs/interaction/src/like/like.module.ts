import { GrowthEventBridgeModule } from '@libs/growth/growth-reward/growth-event-bridge.module';
import { UserModule } from '@libs/user/user.module';
import { Module } from '@nestjs/common'
import { LikeGrowthService } from './like-growth.service'
import { LikeService } from './like.service'

@Module({
  imports: [GrowthEventBridgeModule, UserModule],
  providers: [LikeService, LikeGrowthService],
  exports: [LikeService],
})
export class LikeModule {}
