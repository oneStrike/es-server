import { LikeModule as LikeCoreModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { LikeController } from './like.controller'

@Module({
  imports: [LikeCoreModule],
  controllers: [LikeController],
})
export class LikeModule {}
