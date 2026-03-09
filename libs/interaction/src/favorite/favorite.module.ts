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
