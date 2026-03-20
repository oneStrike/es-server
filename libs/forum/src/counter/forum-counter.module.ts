import { UserModule } from '@libs/user'
import { Module } from '@nestjs/common'
import { ForumCounterService } from './forum-counter.service'

/**
 * 论坛领域计数模块
 * 负责论坛实体计数，并委托全局用户计数服务维护用户计数字段
 */
@Module({
  imports: [UserModule],
  providers: [ForumCounterService],
  exports: [ForumCounterService],
})
export class ForumCounterModule {}
