import { GrowthEventBridgeModule } from '@libs/growth/growth-reward/growth-event-bridge.module';
import { MessageModule } from '@libs/message/message.module';
import { UserModule } from '@libs/user/user.module';
import { Module } from '@nestjs/common'
import { FavoriteGrowthService } from './favorite-growth.service'
import { FavoriteService } from './favorite.service'

@Module({
  imports: [MessageModule, GrowthEventBridgeModule, UserModule],
  providers: [FavoriteService, FavoriteGrowthService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
