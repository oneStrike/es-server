import { UserExperienceModule } from '@libs/growth/experience/experience.module';
import { UserPointModule } from '@libs/growth/point/point.module';
import { TaskModule as GrowthTaskModule } from '@libs/growth/task/task.module';
import { InteractionModule } from '@libs/interaction/interaction.module';
import { MessageModule } from '@libs/message/message.module';
import { UserModule as UserCoreModule } from '@libs/user/user.module';
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
