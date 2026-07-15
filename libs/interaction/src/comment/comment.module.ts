import { DrizzleModule } from '@db/core'
import { SystemConfigModule } from '@libs/config/system-config/system-config.module'
import { EventingModule } from '@libs/eventing/eventing/eventing.module'
import { GrowthEventBridgeModule } from '@libs/growth/growth-reward/growth-event-bridge.module'
import { UserLevelRuleModule } from '@libs/growth/level-rule/level-rule.module'
import { BodyModule } from '@libs/interaction/body/body.module'
import { EmojiModule } from '@libs/interaction/emoji/emoji.module'
import { LikeModule } from '@libs/interaction/like/like.module'
import { MentionModule } from '@libs/interaction/mention/mention.module'
import { ReportModule } from '@libs/interaction/report/report.module'
import { InteractionSummaryModule } from '@libs/interaction/summary/interaction-summary.module'
import { SensitiveWordModule } from '@libs/sensitive-word/sensitive-word.module'
import { UserModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { InteractionNotificationEventModule } from '../eventing/interaction-notification-event.module'
import { CommentGrowthService } from './comment-growth.service'
import { CommentPermissionService } from './comment-permission.service'
import { CommentService } from './comment.service'
import { CommentLikeResolver } from './resolver/comment-like.resolver'
import { CommentReportResolver } from './resolver/comment-report.resolver'

@Module({
  imports: [
    DrizzleModule,
    EventingModule,
    SensitiveWordModule,
    SystemConfigModule,
    GrowthEventBridgeModule,
    UserLevelRuleModule,
    BodyModule,
    EmojiModule,
    LikeModule,
    MentionModule,
    ReportModule,
    InteractionSummaryModule,
    InteractionNotificationEventModule,
    UserModule,
  ],
  providers: [
    CommentGrowthService,
    CommentService,
    CommentPermissionService,
    CommentLikeResolver,
    CommentReportResolver,
  ],
  exports: [CommentService],
})
export class CommentModule {}
