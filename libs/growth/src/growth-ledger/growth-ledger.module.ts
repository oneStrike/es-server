import { Module } from '@nestjs/common'
import { GrowthBalanceQueryService } from './growth-balance-query.service'
import { GrowthLedgerService } from './growth-ledger.service'

/**
 * 成长账本模块
 * 统一管理积分和经验的结算、限流和审计日志
 */
@Module({
  providers: [GrowthLedgerService, GrowthBalanceQueryService],
  exports: [GrowthLedgerService, GrowthBalanceQueryService],
})
export class GrowthLedgerModule {}
