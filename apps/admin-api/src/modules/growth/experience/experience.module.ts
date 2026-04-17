import { UserExperienceModule } from '@libs/growth/experience/experience.module';
import { Module } from '@nestjs/common'
import { AppUserModule } from '../../app-user/app-user.module'
import { ExperienceController } from './experience.controller'

@Module({
  imports: [UserExperienceModule, AppUserModule],
  controllers: [ExperienceController],
  providers: [],
  exports: [],
})
export class ExperienceModule {}
