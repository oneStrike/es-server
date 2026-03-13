import { UserExperienceModule } from '@libs/user'
import { Module } from '@nestjs/common'
import { ExperienceController } from './experience.controller'

@Module({
  imports: [UserExperienceModule],
  controllers: [ExperienceController],
  providers: [],
  exports: [],
})
export class ExperienceModule {}
