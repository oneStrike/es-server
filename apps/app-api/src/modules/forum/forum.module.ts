import { ForumModule as ForumCoreModule } from '@libs/forum/forum.module'
import { CommentModule as CommentCoreModule } from '@libs/interaction/comment/comment.module'
import { Module } from '@nestjs/common'
import { ForumHashtagController } from './forum-hashtag.controller'
import { ForumModeratorApplicationController } from './forum-moderator-application.controller'
import { ForumModeratorController } from './forum-moderator.controller'
import { ForumSearchController } from './forum-search.controller'
import { ForumSectionGroupController } from './forum-section-group.controller'
import { ForumSectionController } from './forum-section.controller'
import { ForumTopicController } from './forum-topic.controller'

@Module({
  imports: [ForumCoreModule, CommentCoreModule],
  controllers: [
    ForumTopicController,
    ForumHashtagController,
    ForumSearchController,
    ForumModeratorController,
    ForumModeratorApplicationController,
    ForumSectionGroupController,
    ForumSectionController,
  ],
})
export class ForumModule {}
