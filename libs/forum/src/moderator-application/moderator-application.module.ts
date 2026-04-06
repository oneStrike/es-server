import { Module } from '@nestjs/common'
import { ForumModeratorModule } from '../moderator/moderator.module';
import { ForumModeratorApplicationService } from './moderator-application.service'

@Module({
  imports: [ForumModeratorModule],
  providers: [ForumModeratorApplicationService],
  exports: [ForumModeratorApplicationService],
})
export class ForumModeratorApplicationModule {}
