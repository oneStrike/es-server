import * as schema from '@db/schema'
import { CheckInDefinitionService } from '../check-in-definition.service'
import {
  CheckInCycleTypeEnum,
  CheckInPlanStatusEnum,
} from '../check-in.constant'

describe('check-in definition service', () => {
  let service: CheckInDefinitionService
  let drizzle: any
  let dbSelectLimitMock: jest.Mock
  let planInsertValuesMock: jest.Mock
  let planInsertReturningMock: jest.Mock
  let planUpdateSetMock: jest.Mock
  let planUpdateWhereMock: jest.Mock
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
    planUpdateWhereMock = jest.fn().mockResolvedValue({ rowCount: 1 })
    planUpdateSetMock = jest.fn(() => ({
      where: planUpdateWhereMock,
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
      update: jest.fn((table: unknown) => {
        if (table === schema.checkInPlan) {
          return {
            set: planUpdateSetMock,
          }
        }

        throw new Error('unexpected update target')
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
      withTransaction: jest.fn(
        async (fn: (input: typeof tx) => Promise<unknown>) => fn(tx),
      ),
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      assertAffectedRows: jest.fn(),
    }

    service = new CheckInDefinitionService(drizzle, {} as any)
  })

  it('创建计划时只写入基础信息，不直接落奖励配置', async () => {
    await service.createPlan(
      {
        planCode: 'growth-check-in',
        planName: '成长签到',
        status: CheckInPlanStatusEnum.DRAFT,
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        allowMakeupCountPerCycle: 2,
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
        baseRewardConfig: null,
        version: 1,
        createdById: 99,
        updatedById: 99,
      }),
    )
    expect(dailyRuleInsertValuesMock).not.toHaveBeenCalled()
    expect(streakRuleInsertValuesMock).not.toHaveBeenCalled()
  })

  it('周计划创建时会拦截未对齐周一的开始日期', async () => {
    await expect(
      service.createPlan(
        {
          planCode: 'growth-check-in',
          planName: '成长签到',
          status: CheckInPlanStatusEnum.DRAFT,
          cycleType: CheckInCycleTypeEnum.WEEKLY,
          startDate: '2026-04-07',
          allowMakeupCountPerCycle: 2,
        },
        99,
      ),
    ).rejects.toThrow('周计划开始日期必须对齐周一')
  })

  it('已发布计划创建时会拦截与其他已发布窗口重叠的时间段', async () => {
    dbSelectLimitMock.mockResolvedValueOnce([{ id: 99 }])

    await expect(
      service.createPlan(
        {
          planCode: 'growth-check-in',
          planName: '成长签到',
          status: CheckInPlanStatusEnum.PUBLISHED,
          cycleType: CheckInCycleTypeEnum.MONTHLY,
          startDate: '2026-04-01',
          endDate: '2026-04-30',
          allowMakeupCountPerCycle: 2,
        },
        99,
      ),
    ).rejects.toThrow('已发布签到计划窗口不能重叠')
  })

  it('已发布计划创建时会拦截当前自然周期内立即切换', async () => {
    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue({
      id: 77,
      cycleType: CheckInCycleTypeEnum.WEEKLY,
      startDate: '2026-04-07',
    })

    await expect(
      service.createPlan(
        {
          planCode: 'growth-check-in',
          planName: '成长签到',
          status: CheckInPlanStatusEnum.PUBLISHED,
          cycleType: CheckInCycleTypeEnum.WEEKLY,
          startDate: '2026-04-06',
          endDate: '2026-04-12',
          allowMakeupCountPerCycle: 2,
        },
        99,
      ),
    ).rejects.toThrow('当前周期内不允许立即切换签到计划')
  })

  it('创建奖励配置时会递增版本并同时写入每日奖励与连续奖励规则', async () => {
    jest.spyOn(service as any, 'getPlanById').mockResolvedValue({
      id: 11,
      version: 1,
      cycleType: CheckInCycleTypeEnum.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      allowMakeupCountPerCycle: 2,
      baseRewardConfig: null,
    })
    jest.spyOn(service as any, 'getPlanDailyRewardRules').mockResolvedValue([])
    jest.spyOn(service as any, 'getPlanRules').mockResolvedValue([])

    await service.createPlanRewardConfig(
      {
        id: 11,
        baseRewardConfig: { points: 5 },
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
        streakRewardRules: [
          {
            ruleCode: 'streak-7',
            streakDays: 7,
            rewardConfig: { points: 70 },
            repeatable: false,
            status: 1,
          },
        ],
      },
      99,
    )

    expect(planUpdateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseRewardConfig: { points: 5 },
        version: 2,
        updatedById: 99,
      }),
    )
    expect(dailyRuleInsertValuesMock).toHaveBeenCalledWith([
      {
        planId: 11,
        planVersion: 2,
        dayIndex: 1,
        rewardConfig: { points: 10 },
      },
      {
        planId: 11,
        planVersion: 2,
        dayIndex: 3,
        rewardConfig: { experience: 30 },
      },
    ])
    expect(streakRuleInsertValuesMock).toHaveBeenCalledWith([
      {
        planId: 11,
        planVersion: 2,
        ruleCode: 'streak-7',
        streakDays: 7,
        rewardConfig: { points: 70 },
        repeatable: false,
        status: 1,
      },
    ])
  })

  it('更新奖励配置时会把未显式传入的现有奖励规则复制到新版本', async () => {
    jest.spyOn(service as any, 'getPlanById').mockResolvedValue({
      id: 11,
      version: 2,
      cycleType: CheckInCycleTypeEnum.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      allowMakeupCountPerCycle: 2,
      baseRewardConfig: { points: 5 },
    })
    jest.spyOn(service as any, 'getPlanDailyRewardRules').mockResolvedValue([
      {
        id: 21,
        planId: 11,
        planVersion: 2,
        dayIndex: 1,
        rewardConfig: { points: 10 },
      },
    ])
    jest.spyOn(service as any, 'getPlanRules').mockResolvedValue([
      {
        id: 31,
        planId: 11,
        planVersion: 2,
        ruleCode: 'streak-3',
        streakDays: 3,
        rewardConfig: { points: 30 },
        repeatable: false,
        status: 1,
      },
    ])

    await service.updatePlanRewardConfig(
      {
        id: 11,
        streakRewardRules: [
          {
            ruleCode: 'streak-7',
            streakDays: 7,
            rewardConfig: { points: 70 },
            repeatable: false,
            status: 1,
          },
        ],
      },
      99,
    )

    expect(planUpdateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 3,
        updatedById: 99,
      }),
    )
    expect(dailyRuleInsertValuesMock).toHaveBeenCalledWith([
      {
        planId: 11,
        planVersion: 3,
        dayIndex: 1,
        rewardConfig: { points: 10 },
      },
    ])
    expect(streakRuleInsertValuesMock).toHaveBeenCalledWith([
      {
        planId: 11,
        planVersion: 3,
        ruleCode: 'streak-7',
        streakDays: 7,
        rewardConfig: { points: 70 },
        repeatable: false,
        status: 1,
      },
    ])
  })

  it('更新计划基础信息时会把当前奖励配置复制到新版本', async () => {
    jest.spyOn(service as any, 'getPlanById').mockResolvedValue({
      id: 11,
      planCode: 'growth-check-in',
      planName: '成长签到',
      status: CheckInPlanStatusEnum.DRAFT,
      version: 2,
      cycleType: CheckInCycleTypeEnum.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      allowMakeupCountPerCycle: 2,
      baseRewardConfig: { points: 5 },
    })
    jest.spyOn(service as any, 'getPlanDailyRewardRules').mockResolvedValue([
      {
        id: 21,
        planId: 11,
        planVersion: 2,
        dayIndex: 1,
        rewardConfig: { points: 10 },
      },
    ])
    jest.spyOn(service as any, 'getPlanRules').mockResolvedValue([
      {
        id: 31,
        planId: 11,
        planVersion: 2,
        ruleCode: 'streak-3',
        streakDays: 3,
        rewardConfig: { points: 30 },
        repeatable: false,
        status: 1,
      },
    ])

    await service.updatePlan(
      {
        id: 11,
        allowMakeupCountPerCycle: 3,
      },
      99,
    )

    expect(planUpdateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowMakeupCountPerCycle: 3,
        baseRewardConfig: { points: 5 },
        version: 3,
        updatedById: 99,
      }),
    )
    expect(dailyRuleInsertValuesMock).toHaveBeenCalledWith([
      {
        planId: 11,
        planVersion: 3,
        dayIndex: 1,
        rewardConfig: { points: 10 },
      },
    ])
    expect(streakRuleInsertValuesMock).toHaveBeenCalledWith([
      {
        planId: 11,
        planVersion: 3,
        ruleCode: 'streak-3',
        streakDays: 3,
        rewardConfig: { points: 30 },
        repeatable: false,
        status: 1,
      },
    ])
  })
})
