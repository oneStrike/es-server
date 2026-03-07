import { MessageModule } from '@libs/message'
import { Module } from '@nestjs/common'
import { LikeService } from './like.service'

@Module({
  imports: [MessageModule],
  providers: [LikeService],
  exports: [LikeService],
})
export class LikeModule {}
