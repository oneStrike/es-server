import { Module } from '@nestjs/common'
import { ForumSectionModule } from '../section/forum-section.module'
import { ModeratorPermissionService } from './moderator-permission.service'
import { ModeratorController } from './moderator.controller'
import { ModeratorService } from './moderator.service'

@Module({
  imports: [ForumSectionModule],
  controllers: [ModeratorController],
  providers: [ModeratorService, ModeratorPermissionService],
  exports: [ModeratorService, ModeratorPermissionService],
})
export class ModeratorModule {}
