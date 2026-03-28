import { UserBadgeModule } from '@libs/growth/badge'
import { UserExperienceModule } from '@libs/growth/experience'
import { GrowthLedgerModule } from '@libs/growth/growth-ledger'
import { UserPointModule } from '@libs/growth/point'
import { UserModule as UserCoreModule } from '@libs/user/core'
import { Module } from '@nestjs/common'
import { AppUserController } from './app-user.controller'
import { AppUserService } from './app-user.service'

@Module({
  imports: [UserCoreModule, UserPointModule, UserExperienceModule, GrowthLedgerModule, UserBadgeModule],
  controllers: [AppUserController],
  providers: [AppUserService],
})
export class AppUserModule {}
