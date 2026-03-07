import { Module } from '@nestjs/common'
import { GrowthLedgerModule } from '../growth-ledger/growth-ledger.module'
import { UserPointRuleService } from './point-rule.service'
import { UserPointService } from './point.service'

/**
 * 积分模块
 * 提供用户积分管理的完整功能
 */
@Module({
  imports: [GrowthLedgerModule],
  providers: [UserPointService, UserPointRuleService],
  exports: [UserPointService, UserPointRuleService],
})
export class UserPointModule {}
