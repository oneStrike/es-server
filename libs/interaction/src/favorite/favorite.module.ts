/**
 * 收藏模块。
 *
 * 说明：
 * - 提供收藏、取消收藏、查询收藏状态等功能
 * - 集成成长奖励、消息通知等能力
 */
import { MessageModule } from '@libs/message'
import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'
import { FavoriteGrowthService } from './favorite-growth.service'
import { FavoriteInteractionService } from './favorite-interaction.service'
import { FavoritePermissionService } from './favorite-permission.service'
import { FavoriteService } from './favorite.service'

@Module({
  imports: [MessageModule, GrowthLedgerModule],
  providers: [
    InteractionTargetAccessService,
    FavoriteService,
    FavoritePermissionService,
    FavoriteInteractionService,
    FavoriteGrowthService,
  ],
  exports: [FavoriteService],
})
export class FavoriteModule {}
