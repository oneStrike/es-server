import { UserExperienceModule } from '@libs/growth/experience'
import { UserPointModule } from '@libs/growth/point'
import { InteractionModule } from '@libs/interaction/module'
import { MessageModule } from '@libs/message/module'
import { UserModule as UserCoreModule } from '@libs/user/core'
import { Module } from '@nestjs/common'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [
    UserCoreModule,
    UserPointModule,
    UserExperienceModule,
    InteractionModule,
    MessageModule,
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
