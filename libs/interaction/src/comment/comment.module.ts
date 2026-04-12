import { GrowthEventBridgeModule } from '@libs/growth/growth-reward/growth-event-bridge.module';
import { EmojiModule } from '@libs/interaction/emoji/emoji.module';
import { LikeModule } from '@libs/interaction/like/like.module';
import { MentionModule } from '@libs/interaction/mention/mention.module';
import { MessageModule } from '@libs/message/message.module';
import { SensitiveWordModule } from '@libs/sensitive-word/sensitive-word.module';
import { SystemConfigModule } from '@libs/system-config/system-config.module';
import { UserModule } from '@libs/user/user.module';
import { Module } from '@nestjs/common'
import { CommentGrowthService } from './comment-growth.service'
import { CommentPermissionService } from './comment-permission.service'
import { CommentService } from './comment.service'
import { CommentLikeResolver } from './resolver/comment-like.resolver'
import { CommentReportResolver } from './resolver/comment-report.resolver'

@Module({
  imports: [
    SensitiveWordModule,
    SystemConfigModule,
    GrowthEventBridgeModule,
    EmojiModule,
    LikeModule,
    MentionModule,
    MessageModule,
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
