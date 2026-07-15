import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { EventDefinitionModule } from '../event-definition/event-definition.module'
import { GrowthEventBridgeModule } from '../growth-reward/growth-event-bridge.module'
import { GrowthRewardSettlementModule } from '../growth-reward/growth-reward-settlement.module'
import { GrowthService } from './growth.service'

/**
 * 成长后台聚合查询模块。
 *
 * 封装后台成长规则和奖励补偿的读写编排，避免入口层直接访问 Drizzle。
 */
@Module({
  imports: [
    DrizzleModule,
    EventDefinitionModule,
    GrowthEventBridgeModule,
    GrowthRewardSettlementModule,
  ],
  providers: [GrowthService],
  exports: [GrowthService],
})
export class GrowthAdminModule {}
