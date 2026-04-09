import { CheckInModule as LibCheckInModule } from '@libs/growth/check-in/check-in.module'
import { Module } from '@nestjs/common'
import { CheckInController } from './check-in.controller'

@Module({
  imports: [LibCheckInModule],
  controllers: [CheckInController],
})
export class CheckInModule {}
