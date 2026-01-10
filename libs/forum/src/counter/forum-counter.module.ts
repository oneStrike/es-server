import { Module } from '@nestjs/common'
import { ForumCounterService } from './forum-counter.service'

/**
 * 论坛计数模块
 * 提供论坛计数器管理功能，包括版块、主题和用户档案的各种计数更新
 */
@Module({
  providers: [ForumCounterService],
  exports: [ForumCounterService],
})
export class ForumCounterModule {}
