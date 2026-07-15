import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { ForumUserActionLogService } from './action-log.service'

@Module({
  imports: [DrizzleModule],
  providers: [ForumUserActionLogService],
  exports: [ForumUserActionLogService],
})
export class ForumUserActionLogModule {}
