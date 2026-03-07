import { Module } from '@nestjs/common'
import { GrowthLedgerService } from './growth-ledger.service'

/**
 * 成长账本模块
 * 统一管理积分和经验的结算、限流和审计日志
 */
@Module({
  providers: [GrowthLedgerService],
  exports: [GrowthLedgerService],
})
export class GrowthLedgerModule {}
