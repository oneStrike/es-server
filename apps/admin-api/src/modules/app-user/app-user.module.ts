import { UserBadgeModule } from '@libs/growth/badge'
import { UserExperienceModule } from '@libs/growth/experience'
import { UserPointModule } from '@libs/growth/point'
import { UserModule as UserCoreModule } from '@libs/user'
import { Module } from '@nestjs/common'
import { AppUserController } from './app-user.controller'
import { AppUserService } from './app-user.service'

@Module({
  imports: [UserCoreModule, UserPointModule, UserExperienceModule, UserBadgeModule],
  controllers: [AppUserController],
  providers: [AppUserService],
})
export class AppUserModule {}
