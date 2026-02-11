import { Module } from '@nestjs/common'
import { ForumConfigModule } from './config/config.module'
import { ModeratorModule } from './moderator/moderator.module'
import { ForumSectionGroupModule } from './section-group/forum-section-group.module'
import { ForumSectionModule } from './section/forum-section.module'
import { SensitiveWordModule } from './sensitive-word/sensitive-word.module'
import { ForumTagModule } from './tag/forum-tag.module'
import { ForumTopicModule } from './topic/topic.module'

@Module({
  imports: [
    ForumConfigModule,
    ModeratorModule,
    SensitiveWordModule,
    ForumTopicModule,
    ForumSectionModule,
    ForumSectionGroupModule,
    ForumTagModule,
  ],
})
export class ForumManagementModule {}
