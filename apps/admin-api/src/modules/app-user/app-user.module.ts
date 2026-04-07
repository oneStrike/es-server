import { UserBadgeModule } from '@libs/growth/badge/user-badge.module'
import { UserExperienceModule } from '@libs/growth/experience/experience.module'
import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { UserPointModule } from '@libs/growth/point/point.module'
import { UserModule as UserCoreModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { AppUserController } from './app-user.controller'
import { AppUserService } from './app-user.service'

@Module({
  imports: [
    UserCoreModule,
    UserPointModule,
    UserExperienceModule,
    GrowthLedgerModule,
    UserBadgeModule,
  ],
  controllers: [AppUserController],
  providers: [AppUserService],
})
export class AppUserModule {}
