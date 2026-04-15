import { UserGrowthRewardService } from './growth-reward.service'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerSourceEnum,
} from '../growth-ledger/growth-ledger.constant'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import { GrowthRewardDedupeResultEnum } from './growth-reward.types'

describe('UserGrowthRewardService', () => {
  function createService() {
    const growthLedgerService = {
      applyByRule: jest.fn(),
    }
    const drizzle = {
      withTransaction: jest.fn(
        async (callback: (tx: object) => Promise<unknown>) => {
          return callback({} as object)
        },
      ),
    }

    return {
      service: new UserGrowthRewardService(
        growthLedgerService as never,
        drizzle as never,
      ),
      growthLedgerService,
      drizzle,
    }
  }

  it('任一资产规则奖励失败时会把整次奖励视为失败而不是留下部分成功结果', async () => {
    const { service, growthLedgerService, drizzle } = createService()
    growthLedgerService.applyByRule
      .mockResolvedValueOnce({
        success: true,
        recordId: 101,
        beforeValue: 1,
        afterValue: 3,
      })
      .mockResolvedValueOnce({
        success: false,
        reason: 'rule_not_found',
      })

    const result = await service.tryRewardByRule({
      userId: 7,
      ruleType: GrowthRuleTypeEnum.COMMENT_LIKED,
      bizKey: 'comment:liked:1',
      source: GrowthLedgerSourceEnum.GROWTH_RULE,
      remark: '评论点赞奖励',
    } as never)

    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
    expect(growthLedgerService.applyByRule).toHaveBeenCalledTimes(2)
    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        dedupeResult: GrowthRewardDedupeResultEnum.FAILED,
        ledgerRecordIds: [],
      }),
    )
    expect(result).not.toHaveProperty('pointsResult')
    expect(result).not.toHaveProperty('experienceResult')
  })

  it('首个资产失败时不会继续执行后续资产奖励', async () => {
    const { service, growthLedgerService } = createService()
    growthLedgerService.applyByRule.mockResolvedValueOnce({
      success: false,
      reason: 'daily_limit',
    })

    const result = await service.tryRewardByRule({
      userId: 7,
      ruleType: GrowthRuleTypeEnum.COMMENT_LIKED,
      bizKey: 'comment:liked:1',
      source: GrowthLedgerSourceEnum.GROWTH_RULE,
      remark: '评论点赞奖励',
    } as never)

    expect(growthLedgerService.applyByRule).toHaveBeenCalledTimes(1)
    expect(growthLedgerService.applyByRule).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        assetType: GrowthAssetTypeEnum.POINTS,
      }),
    )
    expect(result.success).toBe(false)
  })
})
