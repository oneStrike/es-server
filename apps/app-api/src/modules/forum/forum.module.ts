import { ForumModule as ForumCoreModule } from '@libs/forum'
import { CommentModule as CommentCoreModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { ForumModeratorApplicationController } from './forum-moderator-application.controller'
import { ForumSearchController } from './forum-search.controller'
import { ForumController } from './forum.controller'

@Module({
  imports: [ForumCoreModule, CommentCoreModule],
  controllers: [
    ForumController,
    ForumSearchController,
    ForumModeratorApplicationController,
  ],
})
export class ForumModule {}
