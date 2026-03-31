/**
 * 评论模块
 *
 * 功能说明：
 * - 提供评论的创建、回复、删除、查询等功能
 * - 通过解析器模式支持评论的点赞、举报操作
 * - 集成敏感词检测、成长奖励、消息通知等能力
 */
import { GrowthEventBridgeModule } from '@libs/growth/growth-reward'
import { EmojiModule } from '@libs/interaction/emoji'
import { LikeModule } from '@libs/interaction/like'
import { MessageModule } from '@libs/message/module'
import { SensitiveWordModule } from '@libs/sensitive-word'
import { SystemConfigModule } from '@libs/system-config'
import { UserModule } from '@libs/user/core'
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
