import type {
  DispatchDefinedGrowthEventPayload,
  DispatchDefinedGrowthEventResult,
} from './growth-reward.types'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { GrowthEventDispatchService } from './growth-event-dispatch.service'
import { GrowthRewardSettlementService } from './growth-reward-settlement.service'

/**
 * 成长事件桥接服务。
 *
 * 统一接收 producer 侧构造好的定义型事件 envelope，并在执行派发后补齐
 * 通用成长奖励的 durable 失败事实与补偿状态收口。
 */
@Injectable()
export class GrowthEventBridgeService {
  private readonly logger = new Logger(GrowthEventBridgeService.name)

  constructor(
    private readonly growthEventDispatchService: GrowthEventDispatchService,
    private readonly growthRewardSettlementService: GrowthRewardSettlementService,
  ) {}

  /**
   * 派发已进入定义层的成长事件。
   * producer 统一提供稳定 envelope 与 bizKey；桥接层负责在派发后维护补偿事实。
   */
  async dispatchDefinedEvent(
    input: DispatchDefinedGrowthEventPayload,
  ): Promise<DispatchDefinedGrowthEventResult> {
    try {
      const dispatchResult =
        await this.growthEventDispatchService.dispatchDefinedEvent(input)

      if (!dispatchResult.growthHandled) {
        return dispatchResult
      }

      if (dispatchResult.growthResult?.success) {
        await this.growthRewardSettlementService.markSettlementSucceeded(
          input.eventEnvelope.subjectId,
          input.bizKey,
          dispatchResult.growthResult,
        )
        return dispatchResult
      }

      if (dispatchResult.growthResult) {
        await this.growthRewardSettlementService.recordUnsuccessfulSettlement(
          input,
          dispatchResult.growthResult,
        )
      }

      return dispatchResult
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }

      try {
        await this.growthRewardSettlementService.recordExceptionSettlement(
          input,
          error,
        )
      } catch (settlementError) {
        this.logger.warn(
          `growth_reward_settlement_record_failed bizKey=${input.bizKey} eventKey=${input.eventEnvelope.key} error=${
            settlementError instanceof Error
              ? settlementError.message
              : String(settlementError)
          }`,
        )
      }

      throw error
    }
  }
}
