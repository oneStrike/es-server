/**
 * 收藏模块。
 *
 * 说明：
 * - 提供收藏、取消收藏、查询收藏状态等功能
 * - 集成成长奖励、消息通知等能力
 */
import { MessageModule } from '@libs/message'
import { GrowthLedgerModule } from '@libs/user'
import { Module } from '@nestjs/common'
import { FavoriteGrowthService } from './favorite-growth.service'
import { FavoriteService } from './favorite.service'

@Module({
  imports: [MessageModule, GrowthLedgerModule],
  providers: [FavoriteService, FavoriteGrowthService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
