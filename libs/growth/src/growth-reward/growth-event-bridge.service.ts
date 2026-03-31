import type {
  DispatchDefinedGrowthEventInput,
  DispatchDefinedGrowthEventResult,
} from './growth-reward.types'
import {
  canConsumeEventEnvelopeByConsumer,
  EventDefinitionConsumerEnum,
  EventDefinitionService,
} from '@libs/growth/event-definition'
import { TaskService } from '@libs/growth/task'
import { BadRequestException, Injectable } from '@nestjs/common'
import { UserGrowthRewardService } from './growth-reward.service'

/**
 * 成长事件桥接服务
 * 统一接收 producer 侧构造好的定义型事件 envelope，并按 consumer 合同派发基础奖励。
 * 当前阶段先收口 growth 主链路与幂等上下文，task / notification 仅返回可消费判定，不在此处直接执行。
 */
@Injectable()
export class GrowthEventBridgeService {
  constructor(
    private readonly eventDefinitionService: EventDefinitionService,
    private readonly userGrowthRewardService: UserGrowthRewardService,
    private readonly taskService: TaskService,
  ) {}

  /**
   * 派发已进入定义层的成长事件。
   * producer 统一提供稳定 envelope 与 bizKey，桥接层负责判断 consumer 可消费性，并发放基础奖励。
   */
  async dispatchDefinedEvent(
    input: DispatchDefinedGrowthEventInput,
  ): Promise<DispatchDefinedGrowthEventResult> {
    const definition = this.eventDefinitionService.getEventDefinition(
      input.eventEnvelope.code,
    )

    if (!definition) {
      throw new BadRequestException(
        `未找到事件定义：${input.eventEnvelope.code}`,
      )
    }

    const growthBlockedByGovernance = !canConsumeEventEnvelopeByConsumer(
      input.eventEnvelope,
      EventDefinitionConsumerEnum.GROWTH,
    )
    const growthDeclared = definition.consumers.includes(
      EventDefinitionConsumerEnum.GROWTH,
    )
    const taskEligible
      = definition.consumers.includes(EventDefinitionConsumerEnum.TASK)
        && canConsumeEventEnvelopeByConsumer(
          input.eventEnvelope,
          EventDefinitionConsumerEnum.TASK,
        )
    const notificationEligible
      = definition.consumers.includes(EventDefinitionConsumerEnum.NOTIFICATION)
        && canConsumeEventEnvelopeByConsumer(
          input.eventEnvelope,
          EventDefinitionConsumerEnum.NOTIFICATION,
        )
    const taskHandled = taskEligible
    const taskResult = taskEligible
      ? await this.taskService.consumeEventProgress({
          eventEnvelope: input.eventEnvelope,
          bizKey: input.bizKey,
        })
      : undefined

    if (!growthDeclared || growthBlockedByGovernance) {
      return {
        definitionKey: definition.key,
        consumers: [...definition.consumers],
        growthHandled: false,
        growthBlockedByGovernance,
        taskHandled,
        taskEligible,
        notificationEligible,
        taskResult,
      }
    }

    const growthResult = await this.userGrowthRewardService.tryRewardByRule({
      tx: input.tx,
      userId: input.eventEnvelope.subjectId,
      ruleType: input.eventEnvelope.code,
      bizKey: input.bizKey,
      source: input.source,
      remark: input.remark,
      targetType: input.targetType,
      targetId: input.targetId ?? input.eventEnvelope.targetId,
      context: this.buildEventRewardContext(input),
      occurredAt: input.eventEnvelope.occurredAt,
    })

    return {
      definitionKey: definition.key,
      consumers: [...definition.consumers],
      growthHandled: true,
      growthBlockedByGovernance: false,
      taskHandled,
      taskEligible,
      notificationEligible,
      growthResult,
      taskResult,
    }
  }

  private buildEventRewardContext(input: DispatchDefinedGrowthEventInput) {
    return {
      ...(input.eventEnvelope.context ?? {}),
      ...(input.context ?? {}),
      eventCode: input.eventEnvelope.code,
      eventKey: input.eventEnvelope.key,
      eventSubjectId: input.eventEnvelope.subjectId,
      eventSubjectType: input.eventEnvelope.subjectType,
      eventTargetId: input.eventEnvelope.targetId,
      eventTargetType: input.eventEnvelope.targetType,
      eventOperatorId: input.eventEnvelope.operatorId,
      governanceStatus: input.eventEnvelope.governanceStatus,
      occurredAt: input.eventEnvelope.occurredAt.toISOString(),
    }
  }
}
