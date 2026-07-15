import { DrizzleModule } from '@db/core'
import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { UserModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { AppUserGrowthProfileService } from './app-user-growth-profile/app-user-growth-profile.service'

/** APP 用户成长资料的唯一领域模块。 */
@Module({
  imports: [DrizzleModule, GrowthLedgerModule, UserModule],
  providers: [AppUserGrowthProfileService],
  exports: [AppUserGrowthProfileService],
})
export class AppUserGrowthProfileModule {}
