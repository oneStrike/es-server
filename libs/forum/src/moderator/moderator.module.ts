import { CommentModule } from '@libs/interaction/comment/comment.module'
import { Module } from '@nestjs/common'
import { ForumSectionModule } from '../section/forum-section.module'
import { ForumTopicModule } from '../topic/forum-topic.module'
import { ForumModeratorActionLogService } from './moderator-action-log.service'
import { ForumModeratorApplicationService } from './moderator-application.service'
import { ForumModeratorGovernanceService } from './moderator-governance.service'
import { ForumModeratorService } from './moderator.service'

/**
 * 版主模块
 * 统一承载版主 roster、申请流转以及后续治理能力。
 */
@Module({
  imports: [CommentModule, ForumSectionModule, ForumTopicModule],
  controllers: [],
  providers: [
    ForumModeratorActionLogService,
    ForumModeratorApplicationService,
    ForumModeratorGovernanceService,
    ForumModeratorService,
  ],
  exports: [
    ForumModeratorActionLogService,
    ForumModeratorApplicationService,
    ForumModeratorGovernanceService,
    ForumModeratorService,
  ],
})
export class ForumModeratorModule {}
