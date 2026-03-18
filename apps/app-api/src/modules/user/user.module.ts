import { UserExperienceModule, UserPointModule } from '@libs/growth'
import { InteractionModule } from '@libs/interaction'
import { MessageModule } from '@libs/message'
import { UserModule as UserCoreModule } from '@libs/user'
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
