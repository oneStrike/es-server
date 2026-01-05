import { Module } from '@nestjs/common'
import { ForumModule } from '../../forum/forum.module'
import { ModeratorController } from './moderator.controller'
import { ModeratorService } from './moderator.service'

@Module({
  imports: [ForumModule],
  controllers: [ModeratorController],
  providers: [ModeratorService],
  exports: [ModeratorService],
})
export class ModeratorModule {}
