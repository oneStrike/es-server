import { ForumModeratorModule as ModeratorModuleLib } from '@libs/forum/moderator'
import { Module } from '@nestjs/common'
import { ModeratorController } from './moderator.controller'

@Module({
  imports: [ModeratorModuleLib],
  controllers: [ModeratorController],
  providers: [],
  exports: [],
})
export class ModeratorModule {}
