import { GrowthLedgerModule } from '@libs/growth/growth-ledger'
import { MessageModule } from '@libs/message/module'
import { UserModule } from '@libs/user/core'
import { Module } from '@nestjs/common'
import { FavoriteGrowthService } from './favorite-growth.service'
import { FavoriteService } from './favorite.service'

@Module({
  imports: [MessageModule, GrowthLedgerModule, UserModule],
  providers: [FavoriteService, FavoriteGrowthService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
