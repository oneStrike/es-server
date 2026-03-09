/**
 * 点赞模块。
 *
 * 说明：
 * - 提供点赞、取消点赞、查询点赞状态等功能
 * - 集成成长奖励、消息通知等能力
 */
import { MessageModule } from '@libs/message'
import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'
import { InteractionTargetResolverService } from '../interaction-target-resolver.service'
import { LikeGrowthService } from './like-growth.service'
import { LikeInteractionService } from './like-interaction.service'
import { LikePermissionService } from './like-permission.service'
import { LikeService } from './like.service'

@Module({
  imports: [MessageModule, GrowthLedgerModule],
  providers: [
    InteractionTargetAccessService,
    InteractionTargetResolverService,
    LikeService,
    LikePermissionService,
    LikeInteractionService,
    LikeGrowthService,
  ],
  exports: [LikeService],
})
export class LikeModule {}
