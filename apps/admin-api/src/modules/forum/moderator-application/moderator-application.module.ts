import { ForumModeratorModule as ForumModeratorModuleLib } from '@libs/forum/moderator/moderator.module';
import { Module } from '@nestjs/common'
import { ForumModeratorApplicationController } from './moderator-application.controller'

@Module({
  imports: [ForumModeratorModuleLib],
  controllers: [ForumModeratorApplicationController],
})
export class ModeratorApplicationModule {}
