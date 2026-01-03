import { Module } from '@nestjs/common'
import { ForumUserController } from './forum-user.controller'
import { ForumUserService } from './forum-user.service'

/**
 * 论坛用户模块
 * 提供论坛用户管理的完整功能
 */
@Module({
  imports: [],
  controllers: [ForumUserController],
  providers: [ForumUserService],
  exports: [ForumUserService],
})
export class ForumUserModule {}
