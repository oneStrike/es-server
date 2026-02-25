import { SensitiveWordModule } from '@libs/sensitive-word'
import { UserExperienceModule } from '@libs/user/experience'
import { UserLevelRuleModule } from '@libs/user/level-rule'
import { UserPointModule } from '@libs/user/point'
import { Module } from '@nestjs/common'
import { ForumConfigModule } from './config'
import { ForumCounterModule } from './counter'
import { ForumModeratorModule } from './moderator'
import { ForumNotificationModule } from './notification'
import { ForumProfileModule } from './profile'
import { ForumReplyModule } from './reply'
import { ForumReplyLikeModule } from './reply-like'
import { ForumReportModule } from './report'
import { ForumSearchModule } from './search'
import { ForumSectionModule } from './section'
import { ForumSectionGroupModule } from './section-group'
import { ForumTagModule } from './tag'
import { ForumTopicModule } from './topic'
import { ForumTopicFavoriteModule } from './topic-favorite'
import { ForumTopicLikeModule } from './topic-like'
import { ForumViewModule } from './view'

/**
 * 论坛模块
 * 聚合所有论坛相关的子模块
 * 
 * TODO: 统一交互模块重构完成后，将使用 InteractionModule 替换以下模块：
 * - ForumTopicLikeModule -> InteractionModule.LikeModule
 * - ForumTopicFavoriteModule -> InteractionModule.FavoriteModule
 * - ForumViewModule -> InteractionModule.ViewModule
 * - ForumReplyModule -> InteractionModule.CommentModule
 * - ForumReplyLikeModule -> InteractionModule.CommentLikeModule
 * - ForumReportModule -> InteractionModule.CommentReportModule
 */
@Module({
  imports: [
    ForumConfigModule,
    ForumCounterModule,
    UserExperienceModule,
    UserLevelRuleModule,
    ForumModeratorModule,
    ForumNotificationModule,
    UserPointModule,
    ForumProfileModule,
    ForumReplyModule,
    ForumReplyLikeModule,
    ForumReportModule,
    ForumSearchModule,
    ForumSectionModule,
    ForumSectionGroupModule,
    SensitiveWordModule,
    ForumTagModule,
    ForumTopicModule,
    ForumTopicFavoriteModule,
    ForumTopicLikeModule,
    ForumViewModule,
  ],
  exports: [
    ForumConfigModule,
    ForumCounterModule,
    UserExperienceModule,
    UserLevelRuleModule,
    ForumModeratorModule,
    ForumNotificationModule,
    UserPointModule,
    ForumProfileModule,
    ForumReplyModule,
    ForumReplyLikeModule,
    ForumReportModule,
    ForumSearchModule,
    ForumSectionModule,
    ForumSectionGroupModule,
    SensitiveWordModule,
    ForumTagModule,
    ForumTopicModule,
    ForumTopicFavoriteModule,
    ForumTopicLikeModule,
    ForumViewModule,
  ],
})
export class ForumModule {}
