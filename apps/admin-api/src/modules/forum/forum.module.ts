import { Module } from '@nestjs/common'
import { ForumHashtagModule } from './hashtag/forum-hashtag.module'
import { ModeratorApplicationModule } from './moderator-application/moderator-application.module'
import { ModeratorModule } from './moderator/moderator.module'
import { ForumSearchModule } from './search/search.module'
import { ForumSectionGroupModule } from './section-group/forum-section-group.module'
import { ForumSectionModule } from './section/forum-section.module'
import { SensitiveWordModule } from './sensitive-word/sensitive-word.module'
import { ForumTopicModule } from './topic/topic.module'

@Module({
  imports: [
    ModeratorModule,
    ModeratorApplicationModule,
    ForumSearchModule,
    SensitiveWordModule,
    ForumHashtagModule,
    ForumTopicModule,
    ForumSectionModule,
    ForumSectionGroupModule,
  ],
})
export class ForumModule {}
