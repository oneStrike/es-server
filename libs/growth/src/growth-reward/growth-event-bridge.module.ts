import { TaskModule } from '@libs/growth/task'
import { Module } from '@nestjs/common'
import { EventDefinitionModule } from '../event-definition/event-definition.module'
import { GrowthEventBridgeService } from './growth-event-bridge.service'
import { UserGrowthRewardModule } from './growth-reward.module'

/**
 * 成长事件桥接模块
 * 聚合事件定义、基础奖励和任务消费能力，供 producer 统一派发定义型业务事件。
 */
@Module({
  imports: [EventDefinitionModule, UserGrowthRewardModule, TaskModule],
  providers: [GrowthEventBridgeService],
  exports: [GrowthEventBridgeService],
})
export class GrowthEventBridgeModule {}
