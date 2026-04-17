import type { DrizzleService } from '@db/core'
import {
  GrowthLedgerFailReasonEnum,
  GrowthLedgerSourceEnum,
} from '../growth-ledger/growth-ledger.constant'
import { GrowthRewardSettlementService } from './growth-reward-settlement.service'
import {
  GrowthRewardSettlementResultTypeEnum,
  GrowthRewardSettlementStatusEnum,
  GrowthRewardSettlementTypeEnum,
} from './growth-reward.constant'
import { GrowthRewardDedupeResultEnum } from './growth-reward.types'

function createDrizzleStub() {
  const insertChain = {
    values: jest.fn().mockReturnThis(),
    onConflictDoUpdate: jest.fn().mockResolvedValue([]),
    onConflictDoNothing: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
  }
  const updateChain = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue({ rowCount: 1 }),
  }
  const selectChain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
  }

  return {
    db: {
      insert: jest.fn().mockReturnValue(insertChain),
      update: jest.fn().mockReturnValue(updateChain),
      select: jest.fn().mockReturnValue(selectChain),
      query: {
        growthRewardSettlement: {
          findFirst: jest.fn(),
        },
      },
    },
    schema: {
      growthRewardSettlement: {
        id: 'id',
        userId: 'userId',
        bizKey: 'bizKey',
        settlementType: 'settlementType',
        sourceRecordId: 'sourceRecordId',
        eventCode: 'eventCode',
        eventKey: 'eventKey',
        source: 'source',
        targetType: 'targetType',
        targetId: 'targetId',
        eventOccurredAt: 'eventOccurredAt',
        settlementStatus: 'settlementStatus',
        settlementResultType: 'settlementResultType',
        ledgerRecordIds: 'ledgerRecordIds',
        retryCount: 'retryCount',
        lastRetryAt: 'lastRetryAt',
        settledAt: 'settledAt',
        lastError: 'lastError',
        requestPayload: 'requestPayload',
        createdAt: 'createdAt',
      },
    },
    ext: {
      findPagination: jest.fn(),
    },
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
  } as unknown as DrizzleService
}

describe('growthRewardSettlementService', () => {
  it('stores success metadata from the latest growth result', async () => {
    const drizzle = createDrizzleStub()
    ;(
      drizzle.db.query.growthRewardSettlement.findFirst as jest.Mock
    ).mockResolvedValue({
      id: 8,
      retryCount: 2,
      lastRetryAt: new Date('2026-04-17T08:00:00.000Z'),
      ledgerRecordIds: [1],
    })
    const service = new GrowthRewardSettlementService(drizzle)

    await service.markSettlementSucceeded(7, 'topic:create:user:7', {
      success: true,
      source: GrowthLedgerSourceEnum.GROWTH_RULE,
      bizKey: 'topic:create:user:7',
      ruleType: 1,
      dedupeResult: GrowthRewardDedupeResultEnum.IDEMPOTENT,
      ledgerRecordIds: [101, 102],
      rewardResults: [],
    })

    const updateResult = (drizzle.db.update as jest.Mock).mock.results[0].value
    const updatePayload = (updateResult.set as jest.Mock).mock.calls[0][0]
    expect(updatePayload.settlementResultType).toBe(
      GrowthRewardSettlementResultTypeEnum.IDEMPOTENT,
    )
    expect(updatePayload.ledgerRecordIds).toEqual([101, 102])
  })

  it('marks terminal settlement for non-retryable rule rejection', async () => {
    const drizzle = createDrizzleStub()
    const service = new GrowthRewardSettlementService(drizzle)

    await service.recordUnsuccessfulSettlement(
      {
        eventEnvelope: {
          code: 3,
          key: 'TOPIC_LIKED',
          subjectId: 7,
          subjectType: 'user',
          targetId: 99,
          targetType: 'topic',
          occurredAt: new Date('2026-04-17T08:00:00.000Z'),
          governanceStatus: 'none',
        } as never,
        bizKey: 'like:3:99:user:7',
        source: 'like',
      },
      {
        success: false,
        source: GrowthLedgerSourceEnum.GROWTH_RULE,
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
              reason: GrowthLedgerFailReasonEnum.RULE_DISABLED,
            },
          },
          {
            assetType: 2,
            assetKey: '',
            result: {
              success: false,
              duplicated: false,
              reason: GrowthLedgerFailReasonEnum.RULE_DISABLED,
            },
          },
        ],
        errorMessage: '规则已禁用',
      },
    )

    const insertResult = (drizzle.db.insert as jest.Mock).mock.results[0].value
    const valuesCall = (insertResult.values as jest.Mock).mock.calls[0][0]
    expect(valuesCall.settlementStatus).toBe(
      GrowthRewardSettlementStatusEnum.TERMINAL,
    )
    expect(valuesCall.settlementType).toBe(
      GrowthRewardSettlementTypeEnum.GROWTH_EVENT,
    )
    expect(valuesCall.settlementResultType).toBe(
      GrowthRewardSettlementResultTypeEnum.FAILED,
    )
  })

  it('marks terminal settlement when failureReason is rule_not_found without rewardResults', async () => {
    const drizzle = createDrizzleStub()
    const service = new GrowthRewardSettlementService(drizzle)

    await service.recordUnsuccessfulSettlement(
      {
        eventEnvelope: {
          code: 3,
          key: 'TOPIC_LIKED',
          subjectId: 7,
          subjectType: 'user',
          targetId: 99,
          targetType: 'topic',
          occurredAt: new Date('2026-04-17T08:00:00.000Z'),
          governanceStatus: 'none',
        } as never,
        bizKey: 'like:3:99:user:7',
        source: 'like',
      },
      {
        success: false,
        source: GrowthLedgerSourceEnum.GROWTH_RULE,
        bizKey: 'like:3:99:user:7',
        ruleType: 3,
        dedupeResult: GrowthRewardDedupeResultEnum.FAILED,
        ledgerRecordIds: [],
        rewardResults: [],
        failureReason: GrowthLedgerFailReasonEnum.RULE_NOT_FOUND,
        errorMessage: '基础奖励规则不存在',
      },
    )

    const insertResult = (drizzle.db.insert as jest.Mock).mock.results[0].value
    const valuesCall = (insertResult.values as jest.Mock).mock.calls[0][0]
    expect(valuesCall.settlementStatus).toBe(
      GrowthRewardSettlementStatusEnum.TERMINAL,
    )
  })
})
