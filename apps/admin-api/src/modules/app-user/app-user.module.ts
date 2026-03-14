import {
  UserBadgeModule,
  UserExperienceModule,
  UserPointModule,
} from '@libs/growth'
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
