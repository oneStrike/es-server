import { Module } from '@nestjs/common'
import { GrowthRewardSettlementService } from './growth-reward-settlement.service'

/**
 * 成长奖励补偿事实存储模块。
 *
 * 只承载 settlement 事实的持久化、查询与状态同步能力，不负责跨域重试编排。
 */
@Module({
  providers: [GrowthRewardSettlementService],
  exports: [GrowthRewardSettlementService],
})
export class GrowthRewardSettlementModule {}
