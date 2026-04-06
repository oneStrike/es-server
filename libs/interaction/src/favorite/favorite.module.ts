import { GrowthEventBridgeModule } from '@libs/growth/growth-reward'
import { MessageModule } from '@libs/message/module'
import { UserModule } from '@libs/user/index'
import { Module } from '@nestjs/common'
import { FavoriteGrowthService } from './favorite-growth.service'
import { FavoriteService } from './favorite.service'

@Module({
  imports: [MessageModule, GrowthEventBridgeModule, UserModule],
  providers: [FavoriteService, FavoriteGrowthService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
