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
import { ForumSensitiveWordModule } from './sensitive-word'
import { ForumTagModule } from './tag'
import { ForumTopicModule } from './topic'
import { ForumTopicFavoriteModule } from './topic-favorite'
import { ForumTopicLikeModule } from './topic-like'
import { ForumViewModule } from './view'

/**
 * 论坛模块
 * 聚合所有论坛相关的子模块
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
    ForumSensitiveWordModule,
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
    ForumSensitiveWordModule,
    ForumTagModule,
    ForumTopicModule,
    ForumTopicFavoriteModule,
    ForumTopicLikeModule,
    ForumViewModule,
  ],
})
export class ForumModule {}
