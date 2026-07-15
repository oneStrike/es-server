import { DrizzleModule } from '@db/core'
import { AppUserGrowthProfileModule } from '@libs/growth/app-user-growth-profile.module'
import { UserBadgeModule } from '@libs/growth/badge/user-badge.module'
import { UserExperienceModule } from '@libs/growth/experience/experience.module'
import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { UserPointModule } from '@libs/growth/point/point.module'
import { UserModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { AdminAppUserGrowthService } from './admin-app-user-growth.service'

/** 管理端 APP 用户成长资产的领域编排模块。 */
@Module({
  imports: [
    DrizzleModule,
    UserModule,
    AppUserGrowthProfileModule,
    UserPointModule,
    UserExperienceModule,
    GrowthLedgerModule,
    UserBadgeModule,
  ],
  providers: [AdminAppUserGrowthService],
  exports: [AdminAppUserGrowthService],
})
export class AdminAppUserGrowthModule {}
