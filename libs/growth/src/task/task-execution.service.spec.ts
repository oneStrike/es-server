import type { DrizzleService } from '@db/core'
import { BusinessException } from '@libs/platform/exceptions'
import { GrowthRewardSettlementStatusEnum } from '../growth-reward/growth-reward.constant'
import { TaskExecutionService } from './task-execution.service'
import { TaskAssignmentStatusEnum } from './task.constant'

function createDrizzleStub() {
  return {
    db: {
      query: {
        taskAssignment: {
          findFirst: jest.fn().mockResolvedValue({
            id: 88,
            userId: 7,
            taskId: 12,
            completedAt: new Date('2026-04-18T00:00:00.000Z'),
            status: TaskAssignmentStatusEnum.COMPLETED,
            rewardSettlementId: 55,
            rewardSettlement: {
              settlementStatus: GrowthRewardSettlementStatusEnum.TERMINAL,
            },
            task: {
              id: 12,
              title: '完善资料',
              rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
            },
          }),
        },
      },
    },
    schema: {
      task: {},
      taskAssignment: {},
      growthRewardSettlement: {},
      taskProgressLog: {},
      notificationDelivery: {},
      domainEvent: {},
    },
  } as unknown as DrizzleService
}

describe('taskExecutionService retry semantics', () => {
  it('rejects retry when reward settlement is terminal', async () => {
    const service = new TaskExecutionService(
      createDrizzleStub(),
      {} as never,
      {} as never,
    )

    await expect(service.retryTaskAssignmentReward(88, true)).rejects.toThrow(
      BusinessException,
    )
    await expect(service.retryTaskAssignmentReward(88, true)).rejects.toThrow(
      '任务奖励已进入终态失败，无需重试',
    )
  })
})
