import { ForumModeratorModule as ModeratorModuleLib } from '@libs/forum/moderator/moderator.module'
import { Module } from '@nestjs/common'
import { ModeratorActionLogController } from './moderator-action-log.controller'
import { ModeratorController } from './moderator.controller'

@Module({
  imports: [ModeratorModuleLib],
  controllers: [ModeratorController, ModeratorActionLogController],
  providers: [],
  exports: [],
})
export class ModeratorModule {}
