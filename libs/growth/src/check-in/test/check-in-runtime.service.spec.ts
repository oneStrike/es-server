import * as schema from '@db/schema'
import { CheckInRuntimeService } from '../check-in-runtime.service'
import {
  CheckInCycleTypeEnum,
  CheckInRecordTypeEnum,
  CheckInRewardResultTypeEnum,
  CheckInRewardStatusEnum,
  CheckInStreakRewardRuleStatusEnum,
} from '../check-in.constant'

describe('check-in runtime service', () => {
  let service: CheckInRuntimeService
  let drizzle: any

  beforeEach(() => {
    drizzle = {
      db: {},
      ext: {
        findPagination: jest.fn(),
      },
      schema,
    }
    service = new CheckInRuntimeService(drizzle, {} as any)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('summary 会返回最新签到记录中的奖励解析快照', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-09T12:00:00.000Z'))

    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue({
      id: 1,
      planCode: 'growth-check-in',
      planName: '成长签到',
      status: 1,
      cycleType: CheckInCycleTypeEnum.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      allowMakeupCountPerCycle: 2,
      baseRewardConfig: { points: 5 },
    })
    jest.spyOn(service as any, 'getCurrentCycleView').mockResolvedValue({
      id: 10,
      cycleKey: 'month-2026-04-01',
      cycleStartDate: '2026-04-01',
      cycleEndDate: '2026-04-30',
      signedCount: 1,
      makeupUsedCount: 0,
      currentStreak: 1,
      lastSignedDate: '2026-04-09',
      planSnapshot: {
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        allowMakeupCountPerCycle: 2,
        baseRewardConfig: { points: 5 },
        dailyRewardRules: [
          {
            id: 1,
            planVersion: 1,
            dayIndex: 9,
            rewardConfig: { points: 90 },
          },
        ],
        streakRewardRules: [
          {
            id: 2,
            planVersion: 1,
            ruleCode: 'streak-3',
            streakDays: 3,
            rewardConfig: { points: 30 },
            repeatable: false,
            status: CheckInStreakRewardRuleStatusEnum.ENABLED,
          },
        ],
      },
    })
    jest.spyOn(service as any, 'listCycleRecords').mockResolvedValue([
      {
        id: 100,
        signDate: '2026-04-09',
        recordType: CheckInRecordTypeEnum.NORMAL,
        rewardStatus: CheckInRewardStatusEnum.SUCCESS,
        rewardResultType: CheckInRewardResultTypeEnum.APPLIED,
        rewardDayIndex: 9,
        resolvedRewardConfig: { points: 90 },
        baseRewardLedgerIds: [901],
        lastRewardError: null,
        rewardSettledAt: new Date('2026-04-09T12:01:00.000Z'),
        createdAt: new Date('2026-04-09T12:00:00.000Z'),
      },
    ])
    jest.spyOn(service as any, 'buildGrantMapForRecords').mockResolvedValue(new Map())

    const result = await service.getSummary(9)

    expect(result.plan).toEqual({
      id: 1,
      planCode: 'growth-check-in',
      planName: '成长签到',
      status: 1,
      cycleType: CheckInCycleTypeEnum.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      allowMakeupCountPerCycle: 2,
      baseRewardConfig: { points: 5 },
    })
    expect(result.latestRecord).toMatchObject({
      signDate: '2026-04-09',
      rewardDayIndex: 9,
      resolvedRewardConfig: { points: 90 },
    })
    expect(result.todaySigned).toBe(true)
  })

  it('calendar 会返回自然日 dayIndex 与当日计划奖励', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-03T12:00:00.000Z'))

    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue({
      id: 1,
    })
    jest.spyOn(service as any, 'getCurrentCycleView').mockResolvedValue({
      id: 10,
      cycleKey: 'month-2026-04-01',
      cycleStartDate: '2026-04-01',
      cycleEndDate: '2026-04-03',
      planSnapshot: {
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        baseRewardConfig: { points: 5 },
        dailyRewardRules: [
          {
            id: 1,
            planVersion: 1,
            dayIndex: 1,
            rewardConfig: { points: 10 },
          },
          {
            id: 2,
            planVersion: 1,
            dayIndex: 3,
            rewardConfig: { experience: 30 },
          },
        ],
      },
    })
    jest.spyOn(service as any, 'listCycleRecords').mockResolvedValue([
      {
        id: 100,
        signDate: '2026-04-03',
        recordType: CheckInRecordTypeEnum.NORMAL,
        rewardStatus: CheckInRewardStatusEnum.SUCCESS,
        rewardResultType: CheckInRewardResultTypeEnum.APPLIED,
        rewardDayIndex: 3,
        resolvedRewardConfig: { experience: 30 },
        baseRewardLedgerIds: [901],
        lastRewardError: null,
        rewardSettledAt: new Date('2026-04-03T12:01:00.000Z'),
        createdAt: new Date('2026-04-03T12:00:00.000Z'),
      },
    ])
    jest.spyOn(service as any, 'buildGrantMapForRecords').mockResolvedValue(new Map())

    const result = await service.getCalendar(9)

    expect(result.days).toHaveLength(3)
    expect(result.days[0]).toMatchObject({
      signDate: '2026-04-01',
      dayIndex: 1,
      inPlanWindow: true,
      planRewardConfig: { points: 10 },
      isSigned: false,
    })
    expect(result.days[1]).toMatchObject({
      signDate: '2026-04-02',
      dayIndex: 2,
      inPlanWindow: true,
      planRewardConfig: { points: 5 },
      isSigned: false,
    })
    expect(result.days[2]).toMatchObject({
      signDate: '2026-04-03',
      dayIndex: 3,
      inPlanWindow: true,
      planRewardConfig: { experience: 30 },
      isSigned: true,
      rewardStatus: CheckInRewardStatusEnum.SUCCESS,
      rewardResultType: CheckInRewardResultTypeEnum.APPLIED,
    })
  })

  it('reconciliation page 会回显奖励天序号与冻结奖励配置', async () => {
    drizzle.ext.findPagination.mockResolvedValue({
      list: [
        {
          id: 100,
          userId: 9,
          planId: 1,
          cycleId: 10,
          signDate: '2026-04-03',
          recordType: CheckInRecordTypeEnum.NORMAL,
          rewardStatus: CheckInRewardStatusEnum.SUCCESS,
          rewardResultType: CheckInRewardResultTypeEnum.APPLIED,
          rewardDayIndex: 3,
          resolvedRewardConfig: { experience: 30 },
          baseRewardLedgerIds: [901],
          lastRewardError: null,
          createdAt: new Date('2026-04-03T12:00:00.000Z'),
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 20,
    })
    jest.spyOn(service as any, 'buildGrantMapForRecords').mockResolvedValue(new Map())

    const result = await service.getReconciliationPage({
      pageIndex: 1,
      pageSize: 20,
    } as any)

    expect(result.list).toEqual([
      expect.objectContaining({
        recordId: 100,
        rewardDayIndex: 3,
        resolvedRewardConfig: { experience: 30 },
      }),
    ])
  })
})
