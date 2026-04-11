import { FollowModule as FollowCoreModule } from '@libs/interaction/follow/follow.module'
import { Module } from '@nestjs/common'
import { FollowController } from './follow.controller'

@Module({
  imports: [FollowCoreModule],
  controllers: [FollowController],
})
export class FollowModule {}
