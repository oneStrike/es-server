import { Module } from '@nestjs/common'
import { UserBadgeService } from './user-badge.service'

@Module({
  providers: [UserBadgeService],
  exports: [UserBadgeService],
})
export class UserBadgeModule {}
