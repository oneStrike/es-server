import { Module } from '@nestjs/common'
import { ModeratorApplicationModule } from './moderator-application/moderator-application.module'
import { ModeratorModule } from './moderator/moderator.module'
import { ForumSearchModule } from './search/search.module'
import { ForumSectionGroupModule } from './section-group/forum-section-group.module'
import { ForumSectionModule } from './section/forum-section.module'
import { SensitiveWordModule } from './sensitive-word/sensitive-word.module'
import { ForumTagModule } from './tag/forum-tag.module'
import { ForumTopicModule } from './topic/topic.module'

@Module({
  imports: [
    ModeratorModule,
    ModeratorApplicationModule,
    ForumSearchModule,
    SensitiveWordModule,
    ForumTopicModule,
    ForumSectionModule,
    ForumSectionGroupModule,
    ForumTagModule,
  ],
})
export class ForumModule {}
