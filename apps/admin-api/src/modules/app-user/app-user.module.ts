import {
  UserBadgeModule,
  UserExperienceModule,
  UserPointModule,
} from '@libs/user'
import { Module } from '@nestjs/common'
import { AppUserController } from './app-user.controller'
import { AppUserService } from './app-user.service'

@Module({
  imports: [UserPointModule, UserExperienceModule, UserBadgeModule],
  controllers: [AppUserController],
  providers: [AppUserService],
  exports: [],
})
export class AppUserModule {}
