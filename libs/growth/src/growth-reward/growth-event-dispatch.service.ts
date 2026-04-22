import type {
  DispatchDefinedGrowthEventPayload,
  DispatchDefinedGrowthEventResult,
} from './types/growth-event-dispatch.type'
import { EventDefinitionService } from '@libs/growth/event-definition/event-definition.service'
import { EventDefinitionConsumerEnum } from '@libs/growth/event-definition/event-definition.type'
import { canConsumeEventEnvelopeByConsumer } from '@libs/growth/event-definition/event-envelope.type'
import { TaskService } from '@libs/growth/task/task.service'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { UserGrowthRewardService } from './growth-reward.service'

/**
 * 成长事件派发内核。
 *
 * 只负责执行 consumer 路由与基础奖励发放，不承担 durable 失败事实记录。
 */
@Injectable()
export class GrowthEventDispatchService {
  private readonly logger = new Logger(GrowthEventDispatchService.name)

  constructor(
    private readonly eventDefinitionService: EventDefinitionService,
    private readonly userGrowthRewardService: UserGrowthRewardService,
    private readonly taskService: TaskService,
  ) {}

  // 派发已进入定义层的成长事件，并按 consumer 能力分别触发任务推进与基础奖励。
  async dispatchDefinedEvent(
    input: DispatchDefinedGrowthEventPayload,
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
    const taskEligible =
      definition.consumers.includes(EventDefinitionConsumerEnum.TASK) &&
      canConsumeEventEnvelopeByConsumer(
        input.eventEnvelope,
        EventDefinitionConsumerEnum.TASK,
      )
    const notificationEligible =
      definition.consumers.includes(EventDefinitionConsumerEnum.NOTIFICATION) &&
      canConsumeEventEnvelopeByConsumer(
        input.eventEnvelope,
        EventDefinitionConsumerEnum.NOTIFICATION,
      )
    let taskHandled = false
    let taskResult: DispatchDefinedGrowthEventResult['taskResult']
    let taskErrorMessage: string | undefined

    if (taskEligible) {
      try {
        taskResult = await this.taskService.consumeEventProgress({
          eventEnvelope: input.eventEnvelope,
          bizKey: input.bizKey,
        })
        taskHandled = true
      } catch (error) {
        taskErrorMessage =
          error instanceof Error ? error.message : String(error)
        this.logger.warn(
          `growth_task_consumer_failed bizKey=${input.bizKey} eventKey=${input.eventEnvelope.key} error=${taskErrorMessage}`,
        )
      }
    }

    if (!growthDeclared || growthBlockedByGovernance) {
      return {
        definitionKey: definition.key,
        consumers: [...definition.consumers],
        growthHandled: false,
        growthBlockedByGovernance,
        taskHandled,
        taskEligible,
        notificationEligible,
        taskErrorMessage,
        taskResult,
      }
    }

    const growthResult = await this.userGrowthRewardService.tryRewardByRule({
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
      taskErrorMessage,
      growthResult,
      taskResult,
    }
  }

  // 规整事件奖励上下文，补齐账本落账和补偿排障需要的稳定字段。
  private buildEventRewardContext(input: DispatchDefinedGrowthEventPayload) {
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
