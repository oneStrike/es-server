import { WorkAuthorModule } from '@libs/content/author'
import { GrowthLedgerModule } from '@libs/growth/growth-ledger'
import { MessageModule } from '@libs/message/message'
import { UserModule } from '@libs/user'
import { Module } from '@nestjs/common'
import { FollowGrowthService } from './follow-growth.service'
import { FollowService } from './follow.service'
import { AuthorFollowResolver } from './resolver/author-follow.resolver'
import { UserFollowResolver } from './resolver/user-follow.resolver'

@Module({
  imports: [MessageModule, GrowthLedgerModule, UserModule, WorkAuthorModule],
  providers: [
    FollowService,
    FollowGrowthService,
    AuthorFollowResolver,
    UserFollowResolver,
  ],
  exports: [FollowService],
})
export class FollowModule {}
