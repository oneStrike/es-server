import { MemberLevelModule as LibsMemberLevelModule } from '@libs/member'
import { Module } from '@nestjs/common'
import { MemberLevelController } from './member-level.controller'

@Module({
  controllers: [MemberLevelController],
  imports: [LibsMemberLevelModule],
})
export class MemberLevelModule {}
