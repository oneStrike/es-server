import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { GrowthEventBridgeModule } from '@libs/growth/growth-reward/growth-event-bridge.module'
import { BodyModule } from '@libs/interaction/body/body.module'
import { BrowseLogModule } from '@libs/interaction/browse-log/browse-log.module'
import { CommentModule } from '@libs/interaction/comment/comment.module'
import { EmojiModule } from '@libs/interaction/emoji/emoji.module'
import { FavoriteModule } from '@libs/interaction/favorite/favorite.module'
import { FollowModule } from '@libs/interaction/follow/follow.module'
import { LikeModule } from '@libs/interaction/like/like.module'
import { MentionModule } from '@libs/interaction/mention/mention.module'
import { ReportModule } from '@libs/interaction/report/report.module'
import { InteractionSummaryModule } from '@libs/interaction/summary/interaction-summary.module'
import { MessageModule } from '@libs/message/message.module'
import { SensitiveWordModule } from '@libs/sensitive-word/sensitive-word.module'
import { UserModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { ForumUserActionLogModule } from '../action-log/action-log.module'
import { ForumCounterModule } from '../counter/forum-counter.module'
import { ForumHashtagModule } from '../hashtag/forum-hashtag.module'
import { ForumPermissionModule } from '../permission/forum-permission.module'
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
    GrowthLedgerModule,
    SensitiveWordModule,
    MessageModule,
    BodyModule,
    BrowseLogModule,
    CommentModule,
    EmojiModule,
    FavoriteModule,
    FollowModule,
    LikeModule,
    MentionModule,
    ReportModule,
    InteractionSummaryModule,
    UserModule,
    ForumCounterModule,
    ForumHashtagModule,
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
