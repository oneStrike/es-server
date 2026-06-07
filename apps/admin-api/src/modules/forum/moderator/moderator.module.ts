import { ForumModeratorModule as ModeratorModuleLib } from '@libs/forum/moderator/moderator.module'
import { Module } from '@nestjs/common'
import { ModeratorActionLogController } from './moderator-action-log.controller'
import { ModeratorLifecycleLogController } from './moderator-lifecycle-log.controller'
import { ModeratorController } from './moderator.controller'

@Module({
  imports: [ModeratorModuleLib],
  controllers: [
    ModeratorController,
    ModeratorActionLogController,
    ModeratorLifecycleLogController,
  ],
  providers: [],
  exports: [],
})
export class ModeratorModule {}
