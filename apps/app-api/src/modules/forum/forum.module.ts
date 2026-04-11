import { ForumModule as ForumCoreModule } from '@libs/forum/forum.module'
import { CommentModule as CommentCoreModule } from '@libs/interaction/comment/comment.module'
import { Module } from '@nestjs/common'
import { ForumModeratorApplicationController } from './forum-moderator-application.controller'
import { ForumSearchController } from './forum-search.controller'
import { ForumSectionGroupController } from './forum-section-group.controller'
import { ForumSectionController } from './forum-section.controller'
import { ForumTopicController } from './forum-topic.controller'

@Module({
  imports: [ForumCoreModule, CommentCoreModule],
  controllers: [
    ForumTopicController,
    ForumSearchController,
    ForumModeratorApplicationController,
    ForumSectionGroupController,
    ForumSectionController,
  ],
})
export class ForumModule {}
