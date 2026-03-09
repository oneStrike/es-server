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
