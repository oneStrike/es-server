import { Module } from '@nestjs/common'
import { ForumSectionModule } from '../section/forum-section.module'
import { ModeratorController } from './moderator.controller'
import { ModeratorService } from './moderator.service'

@Module({
  imports: [ForumSectionModule],
  controllers: [ModeratorController],
  providers: [ModeratorService],
  exports: [ModeratorService],
})
export class ModeratorModule {}
