import * as schema from '@db/schema'
import { CheckInDefinitionService } from '../check-in-definition.service'
import { CheckInCycleTypeEnum, CheckInPlanStatusEnum } from '../check-in.constant'

describe('check-in definition service', () => {
  let service: CheckInDefinitionService
  let drizzle: any
  let dbSelectLimitMock: jest.Mock
  let planInsertValuesMock: jest.Mock
  let planInsertReturningMock: jest.Mock
  let dailyRuleInsertValuesMock: jest.Mock
  let streakRuleInsertValuesMock: jest.Mock

  beforeEach(() => {
    dbSelectLimitMock = jest.fn().mockResolvedValue([])
    planInsertReturningMock = jest.fn().mockResolvedValue([
      {
        id: 11,
        version: 1,
      },
    ])
    planInsertValuesMock = jest.fn(() => ({
      returning: planInsertReturningMock,
    }))
    dailyRuleInsertValuesMock = jest.fn().mockResolvedValue(undefined)
    streakRuleInsertValuesMock = jest.fn().mockResolvedValue(undefined)

    const tx = {
      insert: jest.fn((table: unknown) => {
        if (table === schema.checkInPlan) {
          return {
            values: planInsertValuesMock,
          }
        }
        if (table === schema.checkInDailyRewardRule) {
          return {
            values: dailyRuleInsertValuesMock,
          }
        }
        if (table === schema.checkInStreakRewardRule) {
          return {
            values: streakRuleInsertValuesMock,
          }
        }

        throw new Error('unexpected insert target')
      }),
    }

    drizzle = {
      db: {
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              limit: dbSelectLimitMock,
            })),
          })),
        })),
      },
      ext: {
        findPagination: jest.fn(),
      },
      schema,
      withTransaction: jest.fn(async (fn: (input: typeof tx) => Promise<unknown>) => fn(tx)),
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      assertAffectedRows: jest.fn(),
    }

    service = new CheckInDefinitionService(drizzle, {} as any)
  })

  it('创建计划时会按 dayIndex 排序写入按日奖励规则且不再落旧 baseRewardConfig', async () => {
    await service.createPlan(
      {
        planCode: 'growth-check-in',
        planName: '成长签到',
        status: CheckInPlanStatusEnum.DRAFT,
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        allowMakeupCountPerCycle: 2,
        dailyRewardRules: [
          {
            dayIndex: 3,
            rewardConfig: { experience: 30 },
          },
          {
            dayIndex: 1,
            rewardConfig: { points: 10 },
          },
        ],
      },
      99,
    )

    expect(planInsertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        planCode: 'growth-check-in',
        planName: '成长签到',
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        allowMakeupCountPerCycle: 2,
        version: 1,
        createdById: 99,
        updatedById: 99,
      }),
    )
    expect(planInsertValuesMock.mock.calls[0][0]).not.toHaveProperty('baseRewardConfig')
    expect(dailyRuleInsertValuesMock).toHaveBeenCalledWith([
      {
        planId: 11,
        planVersion: 1,
        dayIndex: 1,
        rewardConfig: { points: 10 },
      },
      {
        planId: 11,
        planVersion: 1,
        dayIndex: 3,
        rewardConfig: { experience: 30 },
      },
    ])
  })

  it('周计划创建时会拦截未对齐周一的开始日期', async () => {
    await expect(service.createPlan(
      {
        planCode: 'growth-check-in',
        planName: '成长签到',
        status: CheckInPlanStatusEnum.DRAFT,
        cycleType: CheckInCycleTypeEnum.WEEKLY,
        startDate: '2026-04-07',
        allowMakeupCountPerCycle: 2,
        dailyRewardRules: [
          {
            dayIndex: 1,
            rewardConfig: { points: 10 },
          },
        ],
      },
      99,
    )).rejects.toThrow('周计划开始日期必须对齐周一')
  })

  it('已发布计划创建时会拦截与其他已发布窗口重叠的时间段', async () => {
    dbSelectLimitMock.mockResolvedValueOnce([{ id: 99 }])

    await expect(service.createPlan(
      {
        planCode: 'growth-check-in',
        planName: '成长签到',
        status: CheckInPlanStatusEnum.PUBLISHED,
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        allowMakeupCountPerCycle: 2,
        dailyRewardRules: [
          {
            dayIndex: 1,
            rewardConfig: { points: 10 },
          },
        ],
      },
      99,
    )).rejects.toThrow('已发布签到计划窗口不能重叠')
  })

  it('已发布计划创建时会拦截当前自然周期内立即切换', async () => {
    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue({
      id: 77,
      cycleType: CheckInCycleTypeEnum.WEEKLY,
      startDate: '2026-04-07',
    })

    await expect(service.createPlan(
      {
        planCode: 'growth-check-in',
        planName: '成长签到',
        status: CheckInPlanStatusEnum.PUBLISHED,
        cycleType: CheckInCycleTypeEnum.WEEKLY,
        startDate: '2026-04-06',
        endDate: '2026-04-12',
        allowMakeupCountPerCycle: 2,
        dailyRewardRules: [
          {
            dayIndex: 1,
            rewardConfig: { points: 10 },
          },
        ],
      },
      99,
    )).rejects.toThrow('当前周期内不允许立即切换签到计划')
  })
})
