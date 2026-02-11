import { UserBadgeModule } from '@libs/user/badge'
import { Module } from '@nestjs/common'
import { UserBadgeController } from './badge.controller'

@Module({
  imports: [UserBadgeModule],
  controllers: [UserBadgeController],
  providers: [],
  exports: [],
})
export class BadgeModule {}
