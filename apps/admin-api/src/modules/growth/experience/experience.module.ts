import { UserExperienceModule } from '@libs/growth/experience/experience.module';
import { Module } from '@nestjs/common'
import { ExperienceController } from './experience.controller'

@Module({
  imports: [UserExperienceModule],
  controllers: [ExperienceController],
  providers: [],
  exports: [],
})
export class ExperienceModule {}
