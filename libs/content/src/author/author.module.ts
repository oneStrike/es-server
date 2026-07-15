import { DrizzleModule } from '@db/core'
import { FollowModule } from '@libs/interaction/follow/follow.module'
import { Module } from '@nestjs/common'
import { WorkAuthorService } from './author.service'
import { AuthorFollowResolver } from './resolver/author-follow.resolver'

/**
 * 作者管理模块
 * 提供作者相关的功能模块
 */
@Module({
  imports: [DrizzleModule, FollowModule],
  providers: [WorkAuthorService, AuthorFollowResolver],
  exports: [WorkAuthorService],
})
export class WorkAuthorModule {}
