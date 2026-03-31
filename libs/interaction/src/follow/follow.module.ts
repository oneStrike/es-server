import { WorkAuthorModule } from '@libs/content/author'
import { GrowthEventBridgeModule } from '@libs/growth/growth-reward'
import { MessageModule } from '@libs/message/module'
import { UserModule } from '@libs/user/core'
import { Module } from '@nestjs/common'
import { FollowGrowthService } from './follow-growth.service'
import { FollowService } from './follow.service'
import { AuthorFollowResolver } from './resolver/author-follow.resolver'
import { UserFollowResolver } from './resolver/user-follow.resolver'

@Module({
  imports: [MessageModule, GrowthEventBridgeModule, UserModule, WorkAuthorModule],
  providers: [
    FollowService,
    FollowGrowthService,
    AuthorFollowResolver,
    UserFollowResolver,
  ],
  exports: [FollowService],
})
export class FollowModule {}
