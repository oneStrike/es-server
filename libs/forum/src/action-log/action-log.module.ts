import { Module } from '@nestjs/common'
import { ForumUserActionLogService } from './action-log.service'

@Module({
  providers: [ForumUserActionLogService],
  exports: [ForumUserActionLogService],
})
export class ForumUserActionLogModule {}
