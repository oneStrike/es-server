import { UserExperienceModule, UserLevelRuleModule, UserPointModule } from '@libs/growth'
import { InteractionModule } from '@libs/interaction'
import { SensitiveWordModule } from '@libs/sensitive-word'

import { Module } from '@nestjs/common'
import { ForumConfigModule } from './config'
import { ForumCounterModule } from './counter'
import { ForumModeratorModule } from './moderator'
import { ForumProfileModule } from './profile'
import { ForumReplyModule } from './reply'
import { ForumReplyLikeModule } from './reply-like'
import { ForumSearchModule } from './search'
import { ForumSectionModule } from './section'
import { ForumSectionGroupModule } from './section-group'
import { ForumTagModule } from './tag'
import { ForumTopicModule } from './topic'

/**
 * 论坛模块
 * 整合论坛主题、回复、版块、标签、用户画像等功能
 */
@Module({
  imports: [
    InteractionModule,
    ForumConfigModule,
    ForumCounterModule,
    UserExperienceModule,
    UserLevelRuleModule,
    ForumModeratorModule,
    UserPointModule,
    ForumProfileModule,
    ForumReplyModule,
    ForumReplyLikeModule,
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
    UserPointModule,
    ForumProfileModule,
    ForumReplyModule,
    ForumReplyLikeModule,
    ForumSearchModule,
    ForumSectionModule,
    ForumSectionGroupModule,
    SensitiveWordModule,
    ForumTagModule,
    ForumTopicModule,
  ],
})
export class ForumModule {}
