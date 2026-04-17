import { UserBadgeModule } from '@libs/growth/badge/user-badge.module'
import { UserExperienceModule } from '@libs/growth/experience/experience.module'
import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { UserPointModule } from '@libs/growth/point/point.module'
import { AppUserTokenStorageService } from '@libs/identity/token/app-user-token-storage.service'
import { UserModule as UserCoreModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { AppUserCommandService } from './app-user-command.service'
import { AppUserGrowthService } from './app-user-growth.service'
import { AppUserQueryService } from './app-user-query.service'
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
  providers: [
    AppUserService,
    AppUserQueryService,
    AppUserCommandService,
    AppUserGrowthService,
    AppUserTokenStorageService,
  ],
  exports: [AppUserService],
})
export class AppUserModule {}
