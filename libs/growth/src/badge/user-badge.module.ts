import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { UserBadgeService } from './user-badge.service'

@Module({
  imports: [DrizzleModule],
  providers: [UserBadgeService],
  exports: [UserBadgeService],
})
export class UserBadgeModule {}
