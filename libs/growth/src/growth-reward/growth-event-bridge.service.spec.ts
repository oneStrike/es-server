import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition/event-envelope.type'
import { GrowthEventBridgeService } from './growth-event-bridge.service'
import { GrowthRewardDedupeResultEnum } from './growth-reward.types'

describe('growthEventBridgeService', () => {
  it('continues growth reward settlement when task consumer throws', async () => {
    const eventDefinitionService = {
      getEventDefinition: jest.fn().mockReturnValue({
        key: 'CREATE_TOPIC',
        consumers: ['growth', 'task'],
      }),
    }
    const userGrowthRewardService = {
      tryRewardByRule: jest.fn().mockResolvedValue({
        success: true,
        source: 'growth_rule',
        bizKey: 'topic:create:user:7',
        ruleType: 1,
        dedupeResult: GrowthRewardDedupeResultEnum.APPLIED,
        ledgerRecordIds: [101, 102],
      }),
    }
    const taskService = {
      consumeEventProgress: jest
        .fn()
        .mockRejectedValue(new Error('task consumer failed')),
    }

    const service = new GrowthEventBridgeService(
      eventDefinitionService as never,
      userGrowthRewardService as never,
      taskService as never,
    )

    const result = await service.dispatchDefinedEvent({
      eventEnvelope: {
        code: 1,
        key: 'CREATE_TOPIC',
        subjectId: 7,
        subjectType: 'user',
        targetId: 99,
        targetType: 'topic',
        occurredAt: new Date('2026-04-17T07:30:00.000Z'),
        context: {},
        governanceStatus: EventEnvelopeGovernanceStatusEnum.NONE,
      } as never,
      bizKey: 'topic:create:user:7',
      source: 'forum_topic',
      remark: '发表主题奖励',
    })

    expect(taskService.consumeEventProgress).toHaveBeenCalledTimes(1)
    expect(userGrowthRewardService.tryRewardByRule).toHaveBeenCalledTimes(1)
    expect(result.growthHandled).toBe(true)
    expect(result.taskHandled).toBe(false)
    expect(result.growthResult?.success).toBe(true)
  })
})
