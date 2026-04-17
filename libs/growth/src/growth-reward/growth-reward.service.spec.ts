import type { DrizzleService } from '@db/core'
import { GrowthLedgerFailReasonEnum } from '../growth-ledger/growth-ledger.constant'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import { UserGrowthRewardService } from './growth-reward.service'
import { GrowthRewardDedupeResultEnum } from './growth-reward.types'

function createDrizzleStub(
  rewardRules: Array<{
    id: number
    assetType: number
    assetKey: string
    isEnabled: boolean
  }>,
) {
  const selectChain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(rewardRules),
  }

  return {
    db: {
      select: jest.fn().mockReturnValue(selectChain),
    },
    schema: {
      growthRewardRule: {
        id: 'id',
        type: 'type',
        assetType: 'assetType',
        assetKey: 'assetKey',
        isEnabled: 'isEnabled',
      },
    },
    withTransaction: async <T>(callback: (tx: unknown) => Promise<T>) =>
      callback({
        select: jest.fn().mockReturnValue(selectChain),
      }),
  } as unknown as DrizzleService
}

describe('userGrowthRewardService rule settlement semantics', () => {
  it('marks missing rules as a stable failed reason', async () => {
    const service = new UserGrowthRewardService(
      {} as never,
      createDrizzleStub([]),
    )

    const result = await service.tryRewardByRule({
      userId: 7,
      ruleType: GrowthRuleTypeEnum.TOPIC_LIKED,
      bizKey: 'like:3:99:user:7',
      source: 'like',
    })

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        dedupeResult: GrowthRewardDedupeResultEnum.FAILED,
        failureReason: GrowthLedgerFailReasonEnum.RULE_NOT_FOUND,
      }),
    )
  })

  it('marks all-disabled rules as a stable failed reason', async () => {
    const service = new UserGrowthRewardService(
      {} as never,
      createDrizzleStub([
        {
          id: 1,
          assetType: 1,
          assetKey: '',
          isEnabled: false,
        },
        {
          id: 2,
          assetType: 2,
          assetKey: '',
          isEnabled: false,
        },
      ]),
    )

    const result = await service.tryRewardByRule({
      userId: 7,
      ruleType: GrowthRuleTypeEnum.TOPIC_LIKED,
      bizKey: 'like:3:99:user:7',
      source: 'like',
    })

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        dedupeResult: GrowthRewardDedupeResultEnum.FAILED,
        failureReason: GrowthLedgerFailReasonEnum.RULE_DISABLED,
      }),
    )
  })
})
