import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition/event-envelope.type'
import { GrowthEventBridgeService } from './growth-event-bridge.service'
import { GrowthRewardDedupeResultEnum } from './growth-reward.types'

describe('growthEventBridgeService', () => {
  it('marks prior settlement success when growth reward succeeds after task failure isolation', async () => {
    const growthEventDispatchService = {
      dispatchDefinedEvent: jest.fn().mockResolvedValue({
        definitionKey: 'CREATE_TOPIC',
        consumers: ['growth', 'task'],
        growthHandled: true,
        growthBlockedByGovernance: false,
        taskHandled: false,
        taskEligible: true,
        notificationEligible: false,
        taskErrorMessage: 'task consumer failed',
        taskResult: undefined,
        growthResult: {
          success: true,
          source: 'growth_rule',
          bizKey: 'topic:create:user:7',
          ruleType: 1,
          dedupeResult: GrowthRewardDedupeResultEnum.APPLIED,
          ledgerRecordIds: [101, 102],
        },
      }),
    }
    const growthRewardSettlementService = {
      markSettlementSucceeded: jest.fn().mockResolvedValue(undefined),
      recordUnsuccessfulSettlement: jest.fn(),
      recordExceptionSettlement: jest.fn(),
    }

    const service = new GrowthEventBridgeService(
      growthEventDispatchService as never,
      growthRewardSettlementService as never,
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

    expect(growthEventDispatchService.dispatchDefinedEvent).toHaveBeenCalledTimes(1)
    expect(
      growthRewardSettlementService.markSettlementSucceeded,
    ).toHaveBeenCalledWith(
      7,
      'topic:create:user:7',
      expect.objectContaining({
        dedupeResult: GrowthRewardDedupeResultEnum.APPLIED,
        ledgerRecordIds: [101, 102],
      }),
    )
    expect(
      growthRewardSettlementService.recordUnsuccessfulSettlement,
    ).not.toHaveBeenCalled()
    expect(result.growthHandled).toBe(true)
    expect(result.taskHandled).toBe(false)
    expect(result.growthResult?.success).toBe(true)
  })

  it('records durable failure and rethrows when dispatch throws', async () => {
    const growthEventDispatchService = {
      dispatchDefinedEvent: jest
        .fn()
        .mockRejectedValue(new Error('growth transaction failed')),
    }
    const growthRewardSettlementService = {
      markSettlementSucceeded: jest.fn(),
      recordUnsuccessfulSettlement: jest.fn(),
      recordExceptionSettlement: jest.fn().mockResolvedValue(undefined),
    }

    const service = new GrowthEventBridgeService(
      growthEventDispatchService as never,
      growthRewardSettlementService as never,
    )

    const payload = {
      eventEnvelope: {
        code: 3,
        key: 'TOPIC_LIKED',
        subjectId: 7,
        subjectType: 'user',
        targetId: 99,
        targetType: 'topic',
        occurredAt: new Date('2026-04-17T08:00:00.000Z'),
        governanceStatus: EventEnvelopeGovernanceStatusEnum.NONE,
        context: {},
      } as never,
      bizKey: 'like:3:99:user:7',
      source: 'like',
    }

    await expect(service.dispatchDefinedEvent(payload)).rejects.toThrow(
      'growth transaction failed',
    )

    expect(
      growthRewardSettlementService.recordExceptionSettlement,
    ).toHaveBeenCalledWith(payload, expect.any(Error))
    expect(
      growthRewardSettlementService.recordUnsuccessfulSettlement,
    ).not.toHaveBeenCalled()
  })

  it('records durable failure when growth result is unsuccessful without throwing', async () => {
    const growthEventDispatchService = {
      dispatchDefinedEvent: jest.fn().mockResolvedValue({
        definitionKey: 'TOPIC_LIKED',
        consumers: ['growth'],
        growthHandled: true,
        growthBlockedByGovernance: false,
        taskHandled: false,
        taskEligible: false,
        notificationEligible: false,
        growthResult: {
          success: false,
          source: 'growth_rule',
          bizKey: 'like:3:99:user:7',
          ruleType: 3,
          dedupeResult: GrowthRewardDedupeResultEnum.FAILED,
          ledgerRecordIds: [],
          rewardResults: [
            {
              assetType: 1,
              assetKey: '',
              result: {
                success: false,
                duplicated: false,
                reason: 'rule_disabled',
              },
            },
            {
              assetType: 2,
              assetKey: '',
              result: {
                success: false,
                duplicated: false,
                reason: 'rule_disabled',
              },
            },
          ],
          errorMessage: '规则已禁用',
        },
      }),
    }
    const growthRewardSettlementService = {
      markSettlementSucceeded: jest.fn(),
      recordUnsuccessfulSettlement: jest.fn().mockResolvedValue(undefined),
      recordExceptionSettlement: jest.fn(),
    }

    const service = new GrowthEventBridgeService(
      growthEventDispatchService as never,
      growthRewardSettlementService as never,
    )

    const payload = {
      eventEnvelope: {
        code: 3,
        key: 'TOPIC_LIKED',
        subjectId: 7,
        subjectType: 'user',
        targetId: 99,
        targetType: 'topic',
        occurredAt: new Date('2026-04-17T08:00:00.000Z'),
        governanceStatus: EventEnvelopeGovernanceStatusEnum.NONE,
        context: {},
      } as never,
      bizKey: 'like:3:99:user:7',
      source: 'like',
    }

    const result = await service.dispatchDefinedEvent(payload)

    expect(result.growthResult?.success).toBe(false)
    expect(
      growthRewardSettlementService.recordUnsuccessfulSettlement,
    ).toHaveBeenCalledTimes(1)
    expect(
      growthRewardSettlementService.markSettlementSucceeded,
    ).not.toHaveBeenCalled()
  })
})
