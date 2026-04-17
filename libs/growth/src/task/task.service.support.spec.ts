import type { DrizzleService } from '@db/core'
import { GrowthRewardSettlementStatusEnum } from '../growth-reward/growth-reward.constant'
import { TaskAssignmentStatusEnum, TaskUserVisibleStatusEnum } from './task.constant'
import { TaskServiceSupport } from './task.service.support'

class TaskServiceSupportTestHarness extends TaskServiceSupport {
  exposeResolveTaskUserVisibleStatus(input: {
    status: TaskAssignmentStatusEnum
    rewardApplicable: boolean
    rewardSettlementStatus?: GrowthRewardSettlementStatusEnum | null
  }) {
    return this.resolveTaskUserVisibleStatus(input)
  }

  exposeBuildTaskRewardSettlementBizKey(params: {
    assignmentId: number
    taskId: number
    userId: number
  }) {
    return this.buildTaskRewardSettlementBizKey(params)
  }
}

function createDrizzleStub() {
  return {
    db: {},
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

describe('taskServiceSupport', () => {
  it('returns completed when task has no reward settlement requirement', () => {
    const service = new TaskServiceSupportTestHarness(
      createDrizzleStub(),
      {} as never,
      {} as never,
    )

    const visibleStatus = service.exposeResolveTaskUserVisibleStatus({
      status: TaskAssignmentStatusEnum.COMPLETED,
      rewardApplicable: false,
    })

    expect(visibleStatus).toBe(TaskUserVisibleStatusEnum.COMPLETED)
  })

  it('returns reward granted only when reward settlement status is success', () => {
    const service = new TaskServiceSupportTestHarness(
      createDrizzleStub(),
      {} as never,
      {} as never,
    )

    expect(
      service.exposeResolveTaskUserVisibleStatus({
        status: TaskAssignmentStatusEnum.COMPLETED,
        rewardApplicable: true,
        rewardSettlementStatus: GrowthRewardSettlementStatusEnum.SUCCESS,
      }),
    ).toBe(TaskUserVisibleStatusEnum.REWARD_GRANTED)

    expect(
      service.exposeResolveTaskUserVisibleStatus({
        status: TaskAssignmentStatusEnum.COMPLETED,
        rewardApplicable: true,
        rewardSettlementStatus: GrowthRewardSettlementStatusEnum.PENDING,
      }),
    ).toBe(TaskUserVisibleStatusEnum.REWARD_PENDING)
  })

  it('builds stable task reward settlement bizKey', () => {
    const service = new TaskServiceSupportTestHarness(
      createDrizzleStub(),
      {} as never,
      {} as never,
    )

    expect(
      service.exposeBuildTaskRewardSettlementBizKey({
        assignmentId: 88,
        taskId: 12,
        userId: 7,
      }),
    ).toBe('task:complete:12:assignment:88:user:7')
  })
})
