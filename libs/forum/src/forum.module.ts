import { UserExperienceModule } from '@libs/growth/experience/experience.module';
import { UserLevelRuleModule } from '@libs/growth/level-rule/level-rule.module';
import { UserPointModule } from '@libs/growth/point/point.module';
import { InteractionModule } from '@libs/interaction/interaction.module';
import { SensitiveWordModule } from '@libs/sensitive-word/sensitive-word.module';
import { Module } from '@nestjs/common'
import { ForumCounterModule } from './counter/forum-counter.module';
import { ForumModeratorApplicationModule } from './moderator-application/moderator-application.module';
import { ForumModeratorModule } from './moderator/moderator.module';
import { ForumPermissionModule } from './permission/forum-permission.module';
import { UserProfileModule } from './profile/profile.module';
import { ForumSearchModule } from './search/search.module';
import { ForumSectionGroupModule } from './section-group/forum-section-group.module';
import { ForumSectionModule } from './section/forum-section.module';
import { ForumTagModule } from './tag/forum-tag.module';
import { ForumTopicModule } from './topic/forum-topic.module';

/**
 * 论坛模块
 * 整合论坛主题、回复、版块、标签、用户画像等功能
 */
@Module({
  imports: [
    InteractionModule,
    ForumCounterModule,
    UserExperienceModule,
    UserLevelRuleModule,
    ForumModeratorModule,
    ForumModeratorApplicationModule,
    ForumPermissionModule,
    UserPointModule,
    UserProfileModule,
    ForumSearchModule,
    ForumSectionModule,
    ForumSectionGroupModule,
    SensitiveWordModule,
    ForumTagModule,
    ForumTopicModule,
  ],
  exports: [
    InteractionModule,
    ForumCounterModule,
    UserExperienceModule,
    UserLevelRuleModule,
    ForumModeratorModule,
    ForumModeratorApplicationModule,
    ForumPermissionModule,
    UserPointModule,
    UserProfileModule,
    ForumSearchModule,
    ForumSectionModule,
    ForumSectionGroupModule,
    SensitiveWordModule,
    ForumTagModule,
    ForumTopicModule,
  ],
})
export class ForumModule {}
