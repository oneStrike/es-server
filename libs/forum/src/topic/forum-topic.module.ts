import { UserGrowthRewardModule } from '@libs/growth'
import { FavoriteModule, LikeModule, ReportModule } from '@libs/interaction'
import { MessageModule } from '@libs/message'
import { SensitiveWordModule } from '@libs/sensitive-word'
import { UserModule } from '@libs/user'
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
    UserGrowthRewardModule,
    SensitiveWordModule,
    MessageModule,
    FavoriteModule,
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
