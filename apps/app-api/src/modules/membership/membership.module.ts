import { MembershipModule as InteractionMembershipModule } from '@libs/interaction/membership/membership.module'
import { Module } from '@nestjs/common'
import { MembershipController } from './membership.controller'

@Module({
  imports: [InteractionMembershipModule],
  controllers: [MembershipController],
})
export class AppMembershipModule {}
