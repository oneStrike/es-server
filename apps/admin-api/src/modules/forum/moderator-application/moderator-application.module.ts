import { ForumModeratorApplicationModule as ForumModeratorApplicationModuleLib } from '@libs/forum'
import { Module } from '@nestjs/common'
import { ForumModeratorApplicationController } from './moderator-application.controller'

@Module({
  imports: [ForumModeratorApplicationModuleLib],
  controllers: [ForumModeratorApplicationController],
})
export class ModeratorApplicationModule {}
