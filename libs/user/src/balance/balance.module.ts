import { Module } from '@nestjs/common'
import { UserBalanceService } from './balance.service'

@Module({
  providers: [UserBalanceService],
  exports: [UserBalanceService],
})
export class UserBalanceModule {}
