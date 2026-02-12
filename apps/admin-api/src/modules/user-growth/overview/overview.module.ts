import { UserBadgeModule } from '@libs/user/badge'
import { UserLevelRuleModule } from '@libs/user/level-rule'
import { Module } from '@nestjs/common'
import { UserGrowthOverviewController } from './overview.controller'
import { UserGrowthOverviewService } from './overview.service'

@Module({
  imports: [UserLevelRuleModule, UserBadgeModule],
  controllers: [UserGrowthOverviewController],
  providers: [UserGrowthOverviewService],
})
export class OverviewModule {}
