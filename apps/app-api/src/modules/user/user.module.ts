import { UserExperienceModule } from '@libs/growth/experience'
import { UserPointModule } from '@libs/growth/point'
import { TaskModule as GrowthTaskModule } from '@libs/growth/task'
import { InteractionModule } from '@libs/interaction/module'
import { MessageModule } from '@libs/message/module'
import { UserModule as UserCoreModule } from '@libs/user/index'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [
    AuthModule,
    UserCoreModule,
    UserPointModule,
    UserExperienceModule,
    GrowthTaskModule,
    InteractionModule,
    MessageModule,
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
