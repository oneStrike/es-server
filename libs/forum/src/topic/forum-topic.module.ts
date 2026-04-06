import { GrowthEventBridgeModule } from '@libs/growth/growth-reward'
import { BrowseLogModule } from '@libs/interaction/browse-log'
import { CommentModule } from '@libs/interaction/comment'
import { EmojiModule } from '@libs/interaction/emoji'
import { FavoriteModule } from '@libs/interaction/favorite'
import { FollowModule } from '@libs/interaction/follow'
import { LikeModule } from '@libs/interaction/like'
import { ReportModule } from '@libs/interaction/report'
import { MessageModule } from '@libs/message/module'
import { SensitiveWordModule } from '@libs/sensitive-word'
import { UserModule } from '@libs/user/index'
import { Module } from '@nestjs/common'
import { ForumUserActionLogModule } from '../action-log/action-log.module'
import { ForumCounterModule } from '../counter/forum-counter.module'
import { ForumPermissionModule } from '../permission'
import { ForumTopicService } from './forum-topic.service'
import { ForumTopicBrowseLogResolver } from './resolver/forum-topic-browse-log.resolver'
import { ForumTopicCommentResolver } from './resolver/forum-topic-comment.resolver'
import { ForumTopicFavoriteResolver } from './resolver/forum-topic-favorite.resolver'
import { ForumTopicLikeResolver } from './resolver/forum-topic-like.resolver'
import { ForumTopicReportResolver } from './resolver/forum-topic-report.resolver'

/**
 * 论坛主题模块
 * 提供论坛主题管理的完整功能
 */
@Module({
  imports: [
    GrowthEventBridgeModule,
    SensitiveWordModule,
    MessageModule,
    BrowseLogModule,
    CommentModule,
    EmojiModule,
    FavoriteModule,
    FollowModule,
    LikeModule,
    ReportModule,
    UserModule,
    ForumCounterModule,
    ForumPermissionModule,
    ForumUserActionLogModule,
  ],
  controllers: [],
  providers: [
    ForumTopicService,
    ForumTopicFavoriteResolver,
    ForumTopicLikeResolver,
    ForumTopicReportResolver,
    ForumTopicCommentResolver,
    ForumTopicBrowseLogResolver,
  ],
  exports: [
    ForumTopicService,
    ForumTopicFavoriteResolver,
    ForumTopicLikeResolver,
    ForumTopicReportResolver,
    ForumTopicCommentResolver,
    ForumTopicBrowseLogResolver,
  ],
})
export class ForumTopicModule {}
