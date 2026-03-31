import { GrowthLedgerFailReasonEnum } from '../../growth-ledger/growth-ledger.constant'
import { TaskAssignmentRewardResultTypeEnum } from '../../task/task.constant'
import { GrowthRewardDedupeResultEnum } from '../growth-reward.types'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

describe('growth reward service task settlement result', () => {
  it('returns structured rule reward result with ledger ids', async () => {
    const { UserGrowthRewardService } = await import('../growth-reward.service')
    const { GrowthRuleTypeEnum } = await import('../../growth-rule.constant')

    const applyByRule = jest
      .fn()
      .mockResolvedValueOnce({ success: true, recordId: 11 })
      .mockResolvedValueOnce({ success: true, recordId: 12 })

    const service = new UserGrowthRewardService(
      { applyByRule } as any,
      { withTransaction: jest.fn(async (callback) => callback({} as any)) } as any,
    )

    const result = await service.tryRewardByRule({
      userId: 9,
      ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
      bizKey: 'forum:topic:create:18:user:9',
      source: 'forum_topic',
      remark: 'create topic',
      targetId: 18,
    })

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        bizKey: 'forum:topic:create:18:user:9',
        dedupeResult: GrowthRewardDedupeResultEnum.APPLIED,
        ledgerRecordIds: [11, 12],
      }),
    )
    expect(applyByRule).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        bizKey: 'forum:topic:create:18:user:9:POINTS',
        source: 'growth_rule',
      }),
    )
  })

  it('returns skipped rule reward result when both assets are denied', async () => {
    const { UserGrowthRewardService } = await import('../growth-reward.service')
    const { GrowthRuleTypeEnum } = await import('../../growth-rule.constant')

    const applyByRule = jest
      .fn()
      .mockResolvedValueOnce({
        success: false,
        reason: GrowthLedgerFailReasonEnum.RULE_DISABLED,
      })
      .mockResolvedValueOnce({
        success: false,
        reason: GrowthLedgerFailReasonEnum.RULE_DISABLED,
      })

    const service = new UserGrowthRewardService(
      { applyByRule } as any,
      { withTransaction: jest.fn(async (callback) => callback({} as any)) } as any,
    )

    const result = await service.tryRewardByRule({
      userId: 9,
      ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
      bizKey: 'forum:topic:create:18:user:9',
      source: 'forum_topic',
    })

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        dedupeResult: GrowthRewardDedupeResultEnum.SKIPPED,
        ledgerRecordIds: [],
      }),
    )
  })

  it('returns applied result with ledger ids when rewards are granted', async () => {
    const { UserGrowthRewardService } = await import('../growth-reward.service')

    const applyDelta = jest
      .fn()
      .mockResolvedValueOnce({ success: true, recordId: 101 })
      .mockResolvedValueOnce({ success: true, recordId: 102 })

    const service = new UserGrowthRewardService(
      { applyDelta } as any,
      { withTransaction: jest.fn(async (callback) => callback({} as any)) } as any,
    )

    const result = await service.tryRewardTaskComplete({
      userId: 9,
      taskId: 7,
      assignmentId: 18,
      rewardConfig: {
        points: 10,
        experience: 5,
      },
    })

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        resultType: TaskAssignmentRewardResultTypeEnum.APPLIED,
        dedupeResult: GrowthRewardDedupeResultEnum.APPLIED,
        ledgerRecordIds: [101, 102],
      }),
    )
  })

  it('returns idempotent result when both reward ledgers already exist', async () => {
    const { UserGrowthRewardService } = await import('../growth-reward.service')

    const applyDelta = jest
      .fn()
      .mockResolvedValueOnce({
        success: true,
        duplicated: true,
        recordId: 201,
      })
      .mockResolvedValueOnce({
        success: true,
        duplicated: true,
        recordId: 202,
      })

    const service = new UserGrowthRewardService(
      { applyDelta } as any,
      { withTransaction: jest.fn(async (callback) => callback({} as any)) } as any,
    )

    const result = await service.tryRewardTaskComplete({
      userId: 9,
      taskId: 7,
      assignmentId: 18,
      rewardConfig: {
        points: 10,
        experience: 5,
      },
    })

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        resultType: TaskAssignmentRewardResultTypeEnum.IDEMPOTENT,
        dedupeResult: GrowthRewardDedupeResultEnum.IDEMPOTENT,
        ledgerRecordIds: [201, 202],
      }),
    )
  })

  it('returns failed result with readable error when reward grant is rejected', async () => {
    const { UserGrowthRewardService } = await import('../growth-reward.service')

    const applyDelta = jest.fn().mockResolvedValue({
      success: false,
      reason: GrowthLedgerFailReasonEnum.RULE_ZERO,
    })

    const service = new UserGrowthRewardService(
      { applyDelta } as any,
      { withTransaction: jest.fn(async (callback) => callback({} as any)) } as any,
    )

    const result = await service.tryRewardTaskComplete({
      userId: 9,
      taskId: 7,
      assignmentId: 18,
      rewardConfig: {
        points: 10,
      },
    })

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        resultType: TaskAssignmentRewardResultTypeEnum.FAILED,
        dedupeResult: GrowthRewardDedupeResultEnum.FAILED,
        ledgerRecordIds: [],
        errorMessage: '任务奖励发放失败（积分/POINTS）：数值必须大于零',
      }),
    )
  })
})
