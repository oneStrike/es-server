import { MessageModule } from '@libs/message'
import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { LikeGrowthService } from './like-growth.service'
import { LikeInteractionService } from './like-interaction.service'
import { LikePermissionService } from './like-permission.service'
import { LikeService } from './like.service'

@Module({
  imports: [MessageModule, GrowthLedgerModule],
  providers: [
    LikeService,
    LikePermissionService,
    LikeInteractionService,
    LikeGrowthService,
  ],
  exports: [LikeService],
})
export class LikeModule {}
