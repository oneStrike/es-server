import { Module } from '@nestjs/common'
import { GrowthLedgerModule } from '../growth-ledger/growth-ledger.module'
import { UserLevelRuleModule } from '../level-rule/level-rule.module'
import { UserExperienceService } from './experience.service'

/**
 * 经验模块
 * 提供用户经验管理的完整功能
 */
@Module({
  imports: [UserLevelRuleModule, GrowthLedgerModule],
  providers: [UserExperienceService],
  exports: [UserExperienceService],
})
export class UserExperienceModule {}
