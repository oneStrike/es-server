import { WorkAuthorModule } from '@libs/content/author/author.module'
import { GrowthEventBridgeModule } from '@libs/growth/growth-reward/growth-event-bridge.module'
import { MessageDomainEventModule } from '@libs/message/eventing/message-domain-event.module'
import { UserModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { FollowGrowthService } from './follow-growth.service'
import { FollowService } from './follow.service'
import { AuthorFollowResolver } from './resolver/author-follow.resolver'
import { UserFollowResolver } from './resolver/user-follow.resolver'

@Module({
  imports: [
    MessageDomainEventModule,
    GrowthEventBridgeModule,
    UserModule,
    WorkAuthorModule,
  ],
  providers: [
    FollowService,
    FollowGrowthService,
    AuthorFollowResolver,
    UserFollowResolver,
  ],
  exports: [FollowService],
})
export class FollowModule {}
