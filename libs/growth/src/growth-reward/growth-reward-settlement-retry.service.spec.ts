import type { GrowthRewardSettlementService } from './growth-reward-settlement.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { GrowthRewardSettlementRetryService } from './growth-reward-settlement-retry.service'
import {
  GrowthRewardSettlementResultTypeEnum,
  GrowthRewardSettlementStatusEnum,
  GrowthRewardSettlementTypeEnum,
} from './growth-reward.constant'
import { GrowthRewardDedupeResultEnum } from './growth-reward.types'

function createStoreStub() {
  return {
    getSettlementById: jest.fn(),
    updateSettlementState: jest.fn().mockResolvedValue(undefined),
    listPendingSettlementIds: jest.fn().mockResolvedValue([]),
  } as Pick<
    GrowthRewardSettlementService,
    'getSettlementById' | 'updateSettlementState' | 'listPendingSettlementIds'
  >
}

describe('growthRewardSettlementRetryService', () => {
  it('marks settlement success when manual retry re-dispatch succeeds', async () => {
    const store = createStoreStub()
    const growthEventDispatchService = {
      dispatchDefinedEvent: jest.fn().mockResolvedValue({
        growthHandled: true,
        growthBlockedByGovernance: false,
        taskHandled: false,
        taskEligible: false,
        notificationEligible: false,
        definitionKey: 'TOPIC_LIKED',
        consumers: ['growth'],
        growthResult: {
          success: true,
          source: 'growth_rule',
          bizKey: 'like:3:99:user:7',
          ruleType: 3,
          dedupeResult: GrowthRewardDedupeResultEnum.APPLIED,
          ledgerRecordIds: [11, 12],
          rewardResults: [
            {
              assetType: 1,
              assetKey: '',
              result: { success: true, recordId: 11 },
            },
            {
              assetType: 2,
              assetKey: '',
              result: { success: true, recordId: 12 },
            },
          ],
        },
      }),
    }
    ;(store.getSettlementById as jest.Mock)
      .mockResolvedValueOnce({
        id: 5,
        settlementStatus: GrowthRewardSettlementStatusEnum.PENDING,
        settlementType: GrowthRewardSettlementTypeEnum.GROWTH_EVENT,
        retryCount: 1,
        ledgerRecordIds: [],
        lastRetryAt: null,
        requestPayload: {
          bizKey: 'like:3:99:user:7',
          source: 'like',
          eventEnvelope: {
            code: 3,
            key: 'TOPIC_LIKED',
            subjectType: 'user',
            subjectId: 7,
            targetType: 'topic',
            targetId: 99,
            occurredAt: '2026-04-17T08:00:00.000Z',
            governanceStatus: 'none',
          },
        },
      })
      .mockResolvedValueOnce({
        id: 5,
        settlementStatus: GrowthRewardSettlementStatusEnum.SUCCESS,
      })

    const service = new GrowthRewardSettlementRetryService(
      store as never,
      growthEventDispatchService as never,
      {} as never,
      {} as never,
    )

    const success = await service.retrySettlement(5)

    expect(success).toBe(true)
    expect(growthEventDispatchService.dispatchDefinedEvent).toHaveBeenCalledTimes(1)
    expect(store.updateSettlementState).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        settlementStatus: GrowthRewardSettlementStatusEnum.SUCCESS,
        settlementResultType: GrowthRewardSettlementResultTypeEnum.APPLIED,
        retryCount: 2,
      }),
    )
  })

  it('dispatches task reward retry through task service', async () => {
    const store = createStoreStub()
    const taskService = {
      retryTaskAssignmentReward: jest.fn().mockResolvedValue(true),
    }
    ;(store.getSettlementById as jest.Mock)
      .mockResolvedValueOnce({
        id: 9,
        settlementType: GrowthRewardSettlementTypeEnum.TASK_REWARD,
        settlementStatus: GrowthRewardSettlementStatusEnum.PENDING,
        retryCount: 3,
        requestPayload: {
          kind: 'task_reward',
          assignmentId: 88,
          taskId: 12,
          userId: 7,
        },
      })
      .mockResolvedValueOnce({
        id: 9,
        settlementStatus: GrowthRewardSettlementStatusEnum.SUCCESS,
      })

    const service = new GrowthRewardSettlementRetryService(
      store as never,
      {} as never,
      taskService as never,
      {} as never,
    )

    const success = await service.retrySettlement(9)

    expect(success).toBe(true)
    expect(taskService.retryTaskAssignmentReward).toHaveBeenCalledWith(88, true)
  })

  it('dispatches check-in record retry through checkIn service', async () => {
    const store = createStoreStub()
    const checkInService = {
      repairReward: jest.fn().mockResolvedValue(true),
    }
    ;(store.getSettlementById as jest.Mock)
      .mockResolvedValueOnce({
        id: 10,
        settlementType: GrowthRewardSettlementTypeEnum.CHECK_IN_RECORD_REWARD,
        settlementStatus: GrowthRewardSettlementStatusEnum.PENDING,
        retryCount: 1,
        requestPayload: {
          kind: 'check_in_record_reward',
          recordId: 301,
        },
      })
      .mockResolvedValueOnce({
        id: 10,
        settlementStatus: GrowthRewardSettlementStatusEnum.SUCCESS,
      })

    const service = new GrowthRewardSettlementRetryService(
      store as never,
      {} as never,
      {} as never,
      checkInService as never,
    )

    const success = await service.retrySettlement(10, 9)

    expect(success).toBe(true)
    expect(checkInService.repairReward).toHaveBeenCalledWith(
      {
        targetType: 1,
        recordId: 301,
      },
      9,
    )
  })

  it('dispatches check-in streak retry through checkIn service', async () => {
    const store = createStoreStub()
    const checkInService = {
      repairReward: jest.fn().mockResolvedValue(true),
    }
    ;(store.getSettlementById as jest.Mock)
      .mockResolvedValueOnce({
        id: 11,
        settlementType: GrowthRewardSettlementTypeEnum.CHECK_IN_STREAK_REWARD,
        settlementStatus: GrowthRewardSettlementStatusEnum.PENDING,
        retryCount: 1,
        requestPayload: {
          kind: 'check_in_streak_reward',
          grantId: 401,
        },
      })
      .mockResolvedValueOnce({
        id: 11,
        settlementStatus: GrowthRewardSettlementStatusEnum.SUCCESS,
      })

    const service = new GrowthRewardSettlementRetryService(
      store as never,
      {} as never,
      {} as never,
      checkInService as never,
    )

    const success = await service.retrySettlement(11, 9)

    expect(success).toBe(true)
    expect(checkInService.repairReward).toHaveBeenCalledWith(
      {
        targetType: 2,
        grantId: 401,
      },
      9,
    )
  })

  it('keeps non-retryable missing-rule retries in terminal state', async () => {
    const store = createStoreStub()
    const growthEventDispatchService = {
      dispatchDefinedEvent: jest.fn().mockResolvedValue({
        growthHandled: true,
        growthBlockedByGovernance: false,
        taskHandled: false,
        taskEligible: false,
        notificationEligible: false,
        definitionKey: 'TOPIC_LIKED',
        consumers: ['growth'],
        growthResult: {
          success: false,
          source: 'growth_rule',
          bizKey: 'like:3:99:user:7',
          ruleType: 3,
          dedupeResult: GrowthRewardDedupeResultEnum.FAILED,
          ledgerRecordIds: [],
          rewardResults: [],
          failureReason: 'rule_not_found',
          errorMessage: '基础奖励规则不存在',
        },
      }),
    }
    ;(store.getSettlementById as jest.Mock).mockResolvedValue({
      id: 15,
      settlementType: GrowthRewardSettlementTypeEnum.GROWTH_EVENT,
      settlementStatus: GrowthRewardSettlementStatusEnum.PENDING,
      retryCount: 2,
      ledgerRecordIds: [],
      lastRetryAt: null,
      requestPayload: {
        bizKey: 'like:3:99:user:7',
        source: 'like',
        eventEnvelope: {
          code: 3,
          key: 'TOPIC_LIKED',
          subjectType: 'user',
          subjectId: 7,
          targetType: 'topic',
          targetId: 99,
          occurredAt: '2026-04-17T08:00:00.000Z',
          governanceStatus: 'none',
        },
      },
    })

    const service = new GrowthRewardSettlementRetryService(
      store as never,
      growthEventDispatchService as never,
      {} as never,
      {} as never,
    )

    const success = await service.retrySettlement(15)

    expect(success).toBe(false)
    expect(store.updateSettlementState).toHaveBeenCalledWith(
      15,
      expect.objectContaining({
        settlementStatus: GrowthRewardSettlementStatusEnum.TERMINAL,
      }),
    )
  })

  it('marks payload corruption as terminal instead of pending', async () => {
    const store = createStoreStub()
    ;(store.getSettlementById as jest.Mock).mockResolvedValue({
      id: 21,
      settlementType: GrowthRewardSettlementTypeEnum.TASK_REWARD,
      settlementStatus: GrowthRewardSettlementStatusEnum.PENDING,
      retryCount: 0,
      ledgerRecordIds: [],
      lastRetryAt: null,
      requestPayload: {
        kind: 'task_reward',
      },
    })

    const service = new GrowthRewardSettlementRetryService(
      store as never,
      {} as never,
      {} as never,
      {} as never,
    )

    const success = await service.retrySettlement(21)

    expect(success).toBe(false)
    expect(store.updateSettlementState).toHaveBeenCalledWith(
      21,
      expect.objectContaining({
        settlementStatus: GrowthRewardSettlementStatusEnum.TERMINAL,
      }),
    )
  })

  it('marks missing downstream source records as terminal instead of pending', async () => {
    const store = createStoreStub()
    const checkInService = {
      repairReward: jest
        .fn()
        .mockRejectedValue(
          new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '签到记录不存在',
          ),
        ),
    }
    ;(store.getSettlementById as jest.Mock).mockResolvedValue({
      id: 22,
      settlementType: GrowthRewardSettlementTypeEnum.CHECK_IN_RECORD_REWARD,
      settlementStatus: GrowthRewardSettlementStatusEnum.PENDING,
      retryCount: 0,
      ledgerRecordIds: [],
      lastRetryAt: null,
      requestPayload: {
        kind: 'check_in_record_reward',
        recordId: 301,
      },
    })

    const service = new GrowthRewardSettlementRetryService(
      store as never,
      {} as never,
      {} as never,
      checkInService as never,
    )

    const success = await service.retrySettlement(22, 9)

    expect(success).toBe(false)
    expect(store.updateSettlementState).toHaveBeenCalledWith(
      22,
      expect.objectContaining({
        settlementStatus: GrowthRewardSettlementStatusEnum.TERMINAL,
      }),
    )
  })

  it('rejects manual retry for terminal settlements', async () => {
    const store = createStoreStub()
    ;(store.getSettlementById as jest.Mock).mockResolvedValue({
      id: 30,
      settlementType: GrowthRewardSettlementTypeEnum.GROWTH_EVENT,
      settlementStatus: GrowthRewardSettlementStatusEnum.TERMINAL,
      retryCount: 1,
      ledgerRecordIds: [],
      lastRetryAt: null,
      requestPayload: {},
    })

    const service = new GrowthRewardSettlementRetryService(
      store as never,
      {} as never,
      {} as never,
      {} as never,
    )

    await expect(service.retrySettlement(30)).rejects.toThrow(
      '成长奖励已进入终态失败，无需重试',
    )
  })
})
