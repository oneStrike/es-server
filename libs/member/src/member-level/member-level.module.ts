import { Module } from '@nestjs/common'
import { MemberLevelService } from './member-level.service'

@Module({
  providers: [MemberLevelService],
  exports: [MemberLevelService],
})
export class MemberLevelModule {}
