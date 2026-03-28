import { GrowthLedgerFailReasonEnum } from '../growth-ledger/growth-ledger.constant'
import { TaskAssignmentRewardResultTypeEnum } from '../task/task.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

describe('growth reward service task settlement result', () => {
  it('returns applied result with ledger ids when rewards are granted', async () => {
    const { UserGrowthRewardService } = await import('./growth-reward.service')

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
        ledgerRecordIds: [101, 102],
      }),
    )
  })

  it('returns idempotent result when both reward ledgers already exist', async () => {
    const { UserGrowthRewardService } = await import('./growth-reward.service')

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
        ledgerRecordIds: [201, 202],
      }),
    )
  })

  it('returns failed result with readable error when reward grant is rejected', async () => {
    const { UserGrowthRewardService } = await import('./growth-reward.service')

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
        ledgerRecordIds: [],
        errorMessage: '任务奖励发放失败（积分/POINTS）：规则值为零',
      }),
    )
  })
})
