import { InteractionModule } from '@libs/interaction'
import { SensitiveWordModule } from '@libs/sensitive-word'
import { UserExperienceModule } from '@libs/user/experience'
import { UserLevelRuleModule } from '@libs/user/level-rule'
import { UserPointModule } from '@libs/user/point'
import { Module } from '@nestjs/common'
import { ForumConfigModule } from './config'
import { ForumCounterModule } from './counter'
import { ForumInteractionModule } from './interaction'
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

@Module({
  imports: [
    InteractionModule,
    ForumInteractionModule,
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
  ],
  exports: [
    InteractionModule,
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
  ],
})
export class ForumModule {}
