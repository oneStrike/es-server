/**
 * 点赞模块。
 *
 * 说明：
 * - 提供点赞、取消点赞、查询点赞状态等功能
 * - 集成成长奖励、消息通知等能力
 */
import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { LikeGrowthService } from './like-growth.service'
import { LikeService } from './like.service'

@Module({
  imports: [GrowthLedgerModule],
  providers: [LikeService, LikeGrowthService],
  exports: [LikeService],
})
export class LikeModule {}
