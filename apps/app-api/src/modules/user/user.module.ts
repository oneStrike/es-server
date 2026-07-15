import { UserAssetsModule } from '@libs/account/user-assets/user-assets.module'
import { AppUserGrowthProfileModule } from '@libs/growth/app-user-growth-profile.module'
import { UserExperienceModule } from '@libs/growth/experience/experience.module'
import { UserPointModule } from '@libs/growth/point/point.module'
import { TaskModule as GrowthTaskModule } from '@libs/growth/task/task.module'
import { MessageModule } from '@libs/message/message.module'
import { UserModule as UserCoreModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [
    AuthModule,
    UserCoreModule,
    AppUserGrowthProfileModule,
    UserPointModule,
    UserExperienceModule,
    GrowthTaskModule,
    UserAssetsModule,
    MessageModule,
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
