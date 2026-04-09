import * as schema from '@db/schema'
import { CheckInRuntimeService } from '../check-in-runtime.service'
import {
  CheckInCycleTypeEnum,
  CheckInRecordTypeEnum,
  CheckInRewardResultTypeEnum,
  CheckInRewardSourceTypeEnum,
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
        dateRewardRules: [
          {
            id: 1,
            planVersion: 1,
            rewardDate: '2026-04-09',
            rewardConfig: { points: 90 },
          },
        ],
        patternRewardRules: [],
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
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.DATE_RULE,
        resolvedRewardRuleId: 1,
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
      resolvedRewardSourceType: CheckInRewardSourceTypeEnum.DATE_RULE,
      resolvedRewardRuleId: 1,
      resolvedRewardConfig: { points: 90 },
    })
    expect(result.todaySigned).toBe(true)
  })

  it('calendar 会返回展示序号与当日计划奖励', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-30T12:00:00.000Z'))

    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue({
      id: 1,
    })
    jest.spyOn(service as any, 'getCurrentCycleView').mockResolvedValue({
      id: 10,
      cycleKey: 'month-2026-04-01',
      cycleStartDate: '2026-04-28',
      cycleEndDate: '2026-04-30',
      planSnapshot: {
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        baseRewardConfig: { points: 5 },
        dateRewardRules: [
          {
            id: 1,
            planVersion: 1,
            rewardDate: '2026-04-28',
            rewardConfig: { points: 10 },
          },
        ],
        patternRewardRules: [
          {
            id: 2,
            planVersion: 1,
            patternType: 'MONTH_LAST_DAY',
            weekday: null,
            monthDay: null,
            rewardConfig: { experience: 30 },
          },
        ],
      },
    })
    jest.spyOn(service as any, 'listCycleRecords').mockResolvedValue([
      {
        id: 100,
        signDate: '2026-04-30',
        recordType: CheckInRecordTypeEnum.NORMAL,
        rewardStatus: CheckInRewardStatusEnum.SUCCESS,
        rewardResultType: CheckInRewardResultTypeEnum.APPLIED,
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.PATTERN_RULE,
        resolvedRewardRuleId: 2,
        resolvedRewardConfig: { experience: 30 },
        baseRewardLedgerIds: [901],
        lastRewardError: null,
        rewardSettledAt: new Date('2026-04-30T12:01:00.000Z'),
        createdAt: new Date('2026-04-30T12:00:00.000Z'),
      },
    ])
    jest.spyOn(service as any, 'buildGrantMapForRecords').mockResolvedValue(new Map())

    const result = await service.getCalendar(9)

    expect(result.days).toHaveLength(3)
    expect(result.days[0]).toMatchObject({
      signDate: '2026-04-28',
      dayIndex: 28,
      inPlanWindow: true,
      planRewardConfig: { points: 10 },
      isSigned: false,
    })
    expect(result.days[1]).toMatchObject({
      signDate: '2026-04-29',
      dayIndex: 29,
      inPlanWindow: true,
      planRewardConfig: { points: 5 },
      isSigned: false,
    })
    expect(result.days[2]).toMatchObject({
      signDate: '2026-04-30',
      dayIndex: 30,
      inPlanWindow: true,
      planRewardConfig: { experience: 30 },
      isSigned: true,
      rewardStatus: CheckInRewardStatusEnum.SUCCESS,
      rewardResultType: CheckInRewardResultTypeEnum.APPLIED,
    })
  })

  it('reconciliation page 会回显奖励来源、规则 ID 与冻结奖励配置', async () => {
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
          resolvedRewardSourceType: CheckInRewardSourceTypeEnum.PATTERN_RULE,
          resolvedRewardRuleId: 23,
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
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.PATTERN_RULE,
        resolvedRewardRuleId: 23,
        resolvedRewardConfig: { experience: 30 },
      }),
    ])
  })
})
