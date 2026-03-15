import { UserGrowthRewardModule } from '@libs/growth'
import { MessageModule } from '@libs/message'
import { SensitiveWordModule } from '@libs/sensitive-word'
import { Module } from '@nestjs/common'
import { ForumUserActionLogModule } from '../action-log/action-log.module'
import { ForumCounterModule } from '../counter/forum-counter.module'
import { ForumReplyService } from './forum-reply.service'

/**
 * 论坛回复模块
 * 提供论坛回复管理的完整功能
 */
@Module({
  imports: [
    MessageModule,
    SensitiveWordModule,
    ForumCounterModule,
    ForumUserActionLogModule,
    UserGrowthRewardModule,
  ],
  providers: [ForumReplyService],
  exports: [ForumReplyService],
})
export class ForumReplyModule {}
