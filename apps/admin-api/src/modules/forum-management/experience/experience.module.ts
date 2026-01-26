import { ForumExperienceModule as ExperienceModuleLib } from '@libs/user/experience'
import { Module } from '@nestjs/common'
import { ExperienceController } from './experience.controller'

@Module({
  imports: [ExperienceModuleLib],
  controllers: [ExperienceController],
  providers: [],
  exports: [],
})
export class ExperienceModule {}
