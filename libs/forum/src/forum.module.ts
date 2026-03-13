import { InteractionModule } from '@libs/interaction'
import { SensitiveWordModule } from '@libs/sensitive-word'
import { UserExperienceModule, UserLevelRuleModule, UserPointModule } from '@libs/user'

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
