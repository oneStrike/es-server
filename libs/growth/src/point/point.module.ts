import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { GrowthLedgerModule } from '../growth-ledger/growth-ledger.module'
import { UserPointService } from './point.service'

/**
 * 积分模块
 * 提供用户积分管理的完整功能
 */
@Module({
  imports: [DrizzleModule, GrowthLedgerModule],
  providers: [UserPointService],
  exports: [UserPointService],
})
export class UserPointModule {}
