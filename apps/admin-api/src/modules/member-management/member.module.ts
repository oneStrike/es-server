import { Module } from '@nestjs/common'
import { MemberLevelModule } from './member-level/member-level.module'

@Module({
  controllers: [],
  imports: [MemberLevelModule],
})
export class MemberModule {}
