import { FollowModule } from '@libs/interaction/follow/follow.module'
import { SensitiveWordModule } from '@libs/sensitive-word/sensitive-word.module'
import { SystemConfigModule } from '@libs/system-config/system-config.module'
import { Module } from '@nestjs/common'
import { ForumPermissionModule } from '../permission/forum-permission.module'
import { ForumHashtagBodyService } from './forum-hashtag-body.service'
import { ForumHashtagCounterService } from './forum-hashtag-counter.service'
import { ForumHashtagReferenceService } from './forum-hashtag-reference.service'
import { ForumHashtagService } from './forum-hashtag.service'
import { ForumHashtagFollowResolver } from './resolver/forum-hashtag-follow.resolver'

/**
 * forum 话题模块。
 * 统一提供 hashtag 资源、正文物化、引用事实和关注解析能力。
 */
@Module({
  imports: [
    FollowModule,
    ForumPermissionModule,
    SensitiveWordModule,
    SystemConfigModule,
  ],
  providers: [
    ForumHashtagCounterService,
    ForumHashtagReferenceService,
    ForumHashtagBodyService,
    ForumHashtagService,
    ForumHashtagFollowResolver,
  ],
  exports: [
    ForumHashtagCounterService,
    ForumHashtagReferenceService,
    ForumHashtagBodyService,
    ForumHashtagService,
    ForumHashtagFollowResolver,
  ],
})
export class ForumHashtagModule {}
