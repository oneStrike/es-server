import { DrizzleModule } from '@db/core'
import { GrowthEventBridgeModule } from '@libs/growth/growth-reward/growth-event-bridge.module'
import { UserLevelRuleModule } from '@libs/growth/level-rule/level-rule.module'
import { UserModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { FavoriteGrowthService } from './favorite-growth.service'
import { FavoriteService } from './favorite.service'

@Module({
  imports: [
    DrizzleModule,
    GrowthEventBridgeModule,
    UserLevelRuleModule,
    UserModule,
  ],
  providers: [FavoriteService, FavoriteGrowthService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
