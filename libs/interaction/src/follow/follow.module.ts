import { DrizzleModule } from '@db/core'
import { EventingModule } from '@libs/eventing/eventing/eventing.module'
import { GrowthEventBridgeModule } from '@libs/growth/growth-reward/growth-event-bridge.module'
import { UserModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { InteractionNotificationEventModule } from '../eventing/interaction-notification-event.module'
import { FollowGrowthService } from './follow-growth.service'
import { FollowService } from './follow.service'
import { UserFollowResolver } from './resolver/user-follow.resolver'

@Module({
  imports: [
    DrizzleModule,
    EventingModule,
    InteractionNotificationEventModule,
    GrowthEventBridgeModule,
    UserModule,
  ],
  providers: [FollowService, FollowGrowthService, UserFollowResolver],
  exports: [FollowService],
})
export class FollowModule {}
