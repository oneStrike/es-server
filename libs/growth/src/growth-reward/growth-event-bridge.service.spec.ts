import {
  createDefinedEventEnvelope,
  EventEnvelopeGovernanceStatusEnum,
} from '@libs/growth/event-definition/event-envelope.type'
import { EventDefinitionConsumerEnum } from '@libs/growth/event-definition/event-definition.type'
import { GrowthLedgerSourceEnum } from '@libs/growth/growth-ledger/growth-ledger.constant'
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import { GrowthEventBridgeService } from './growth-event-bridge.service'
import { GrowthRewardDedupeResultEnum } from './growth-reward.types'

describe('GrowthEventBridgeService', () => {
  let eventDefinitionService: { getEventDefinition: jest.Mock }
  let userGrowthRewardService: { tryRewardByRule: jest.Mock }
  let taskService: { consumeEventProgress: jest.Mock }
  let service: GrowthEventBridgeService

  beforeEach(() => {
    eventDefinitionService = {
      getEventDefinition: jest.fn(),
    }
    userGrowthRewardService = {
      tryRewardByRule: jest.fn(),
    }
    taskService = {
      consumeEventProgress: jest.fn(),
    }

    service = new GrowthEventBridgeService(
      eventDefinitionService as never,
      userGrowthRewardService as never,
      taskService as never,
    )
  })

  it('派发成长奖励时不会再向 reward service 透传 tx 字段', async () => {
    eventDefinitionService.getEventDefinition.mockReturnValue({
      key: 'COMMENT_LIKED',
      consumers: [
        EventDefinitionConsumerEnum.GROWTH,
        EventDefinitionConsumerEnum.TASK,
      ],
    })
    taskService.consumeEventProgress.mockResolvedValue({
      matchedTaskIds: [],
      progressedAssignmentIds: [],
      completedAssignmentIds: [],
      duplicateAssignmentIds: [],
    })
    userGrowthRewardService.tryRewardByRule.mockResolvedValue({
      success: true,
      source: GrowthLedgerSourceEnum.GROWTH_RULE,
      bizKey: 'comment:liked:1',
      ruleType: GrowthRuleTypeEnum.COMMENT_LIKED,
      dedupeResult: GrowthRewardDedupeResultEnum.APPLIED,
      ledgerRecordIds: [10, 11],
    })

    await service.dispatchDefinedEvent({
      eventEnvelope: createDefinedEventEnvelope({
        code: GrowthRuleTypeEnum.COMMENT_LIKED,
        subjectId: 7,
        targetId: 9,
      }),
      bizKey: 'comment:liked:1',
      source: 'comment_like',
    })

    expect(userGrowthRewardService.tryRewardByRule).toHaveBeenCalledTimes(1)
    expect(
      userGrowthRewardService.tryRewardByRule.mock.calls[0][0],
    ).not.toHaveProperty('tx')
  })

  it('治理阻断时会跳过成长奖励并保留阻断结果', async () => {
    eventDefinitionService.getEventDefinition.mockReturnValue({
      key: 'CREATE_COMMENT',
      consumers: [
        EventDefinitionConsumerEnum.GROWTH,
        EventDefinitionConsumerEnum.TASK,
      ],
    })

    const result = await service.dispatchDefinedEvent({
      eventEnvelope: createDefinedEventEnvelope({
        code: GrowthRuleTypeEnum.CREATE_COMMENT,
        subjectId: 7,
        targetId: 9,
        governanceStatus: EventEnvelopeGovernanceStatusEnum.PENDING,
      }),
      bizKey: 'comment:create:9:user:7',
      source: 'comment',
    })

    expect(userGrowthRewardService.tryRewardByRule).not.toHaveBeenCalled()
    expect(taskService.consumeEventProgress).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({
        growthHandled: false,
        growthBlockedByGovernance: true,
        taskHandled: false,
        taskEligible: false,
      }),
    )
  })
})
