import { Module } from '@nestjs/common'
import { GrowthLedgerModule } from '../growth-ledger/growth-ledger.module'
import { UserGrowthRewardService } from './growth-reward.service'

/**
 * 用户成长奖励模块
 * 统一协调积分和经验的奖励发放
 */
@Module({
  imports: [GrowthLedgerModule],
  providers: [UserGrowthRewardService],
  exports: [UserGrowthRewardService],
})
export class UserGrowthRewardModule {}
