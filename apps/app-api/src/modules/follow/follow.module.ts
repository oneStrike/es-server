import { FollowModule as FollowCoreModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { FollowController } from './follow.controller'

@Module({
  imports: [FollowCoreModule],
  controllers: [FollowController],
})
export class FollowModule {}
