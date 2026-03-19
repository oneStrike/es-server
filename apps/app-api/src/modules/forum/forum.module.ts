import { ForumModule as ForumCoreModule } from '@libs/forum'
import { Module } from '@nestjs/common'
import { ForumModeratorApplicationController } from './forum-moderator-application.controller'
import { ForumNotificationController } from './forum-notification.controller'
import { ForumSearchController } from './forum-search.controller'
import { ForumController } from './forum.controller'

@Module({
  imports: [ForumCoreModule],
  controllers: [
    ForumController,
    ForumSearchController,
    ForumNotificationController,
    ForumModeratorApplicationController,
  ],
})
export class ForumModule {}
