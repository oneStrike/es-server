import { Module } from '@nestjs/common'
import { CheckInModule } from '../check-in/check-in.module'
import { EventDefinitionModule } from '../event-definition/event-definition.module'
import { TaskModule } from '../task/task.module'
import { GrowthEventBridgeService } from './growth-event-bridge.service'
import { GrowthEventDispatchService } from './growth-event-dispatch.service'
import { GrowthRewardSettlementRetryService } from './growth-reward-settlement-retry.service'
import { GrowthRewardSettlementModule } from './growth-reward-settlement.module'
import { UserGrowthRewardModule } from './growth-reward.module'

/**
 * 成长事件桥接模块
 * 聚合事件定义、基础奖励和任务消费能力，供 producer 统一派发定义型业务事件。
 */
@Module({
  imports: [
    EventDefinitionModule,
    UserGrowthRewardModule,
    TaskModule,
    CheckInModule,
    GrowthRewardSettlementModule,
  ],
  providers: [
    GrowthEventDispatchService,
    GrowthRewardSettlementRetryService,
    GrowthEventBridgeService,
  ],
  exports: [GrowthEventBridgeService, GrowthRewardSettlementRetryService],
})
export class GrowthEventBridgeModule {}
