import * as schema from '@db/schema'
import { CheckInRuntimeService } from '../check-in-runtime.service'
import {
  CheckInCycleTypeEnum,
  CheckInPatternRewardRuleTypeEnum,
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
      db: {
        query: {
          appUser: {
            findMany: jest.fn(),
          },
        },
      },
      buildPage: jest.fn((input: { pageIndex?: number; pageSize?: number }) => {
        const pageIndex = Math.max(1, Math.floor(Number(input.pageIndex ?? 1)))
        const pageSize = Math.min(
          Math.max(1, Math.floor(Number(input.pageSize ?? 15))),
          500,
        )

        return {
          pageIndex,
          pageSize,
          limit: pageSize,
          offset: (pageIndex - 1) * pageSize,
        }
      }),
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
      rewardDefinition: {
        baseRewardConfig: { points: 5 },
        dateRewardRules: [
          {
            rewardDate: '2026-04-09',
            rewardConfig: { points: 90 },
          },
        ],
        patternRewardRules: [],
        streakRewardRules: [
          {
            ruleCode: 'streak-3',
            streakDays: 3,
            rewardConfig: { points: 30 },
            repeatable: false,
            status: CheckInStreakRewardRuleStatusEnum.ENABLED,
          },
        ],
      },
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
      rewardDefinition: {
        baseRewardConfig: { points: 5 },
        dateRewardRules: [
          {
            rewardDate: '2026-04-09',
            rewardConfig: { points: 90 },
          },
        ],
        patternRewardRules: [],
        streakRewardRules: [
          {
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
        resolvedRewardRuleKey: 'DATE:2026-04-09',
        resolvedRewardConfig: { points: 90 },
        baseRewardLedgerIds: [901],
        lastRewardError: null,
        rewardSettledAt: new Date('2026-04-09T12:01:00.000Z'),
        createdAt: new Date('2026-04-09T12:00:00.000Z'),
      },
    ])
    jest
      .spyOn(service as any, 'buildGrantMapForRecords')
      .mockResolvedValue(new Map())

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
      resolvedRewardRuleKey: 'DATE:2026-04-09',
      resolvedRewardConfig: { points: 90 },
    })
    expect(result.todaySigned).toBe(true)
  })

  it('calendar 会返回展示序号与当日计划奖励', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-30T12:00:00.000Z'))

    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue({
      id: 1,
      planCode: 'growth-check-in',
      planName: '成长签到',
      status: 1,
      cycleType: CheckInCycleTypeEnum.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      allowMakeupCountPerCycle: 2,
      rewardDefinition: {
        baseRewardConfig: { points: 5 },
        dateRewardRules: [],
        patternRewardRules: [],
        streakRewardRules: [],
      },
    })
    jest.spyOn(service as any, 'getCurrentCycleView').mockResolvedValue({
      id: 10,
      cycleKey: 'month-2026-04-01',
      cycleStartDate: '2026-04-28',
      cycleEndDate: '2026-04-30',
      rewardDefinition: {
        baseRewardConfig: { points: 5 },
        dateRewardRules: [
          {
            rewardDate: '2026-04-28',
            rewardConfig: { points: 10 },
          },
        ],
        patternRewardRules: [
          {
            patternType: CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
            weekday: null,
            monthDay: null,
            rewardConfig: { experience: 30 },
          },
        ],
        streakRewardRules: [],
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
        resolvedRewardRuleKey: 'MONTH_LAST_DAY',
        resolvedRewardConfig: { experience: 30 },
        baseRewardLedgerIds: [901],
        lastRewardError: null,
        rewardSettledAt: new Date('2026-04-30T12:01:00.000Z'),
        createdAt: new Date('2026-04-30T12:00:00.000Z'),
      },
    ])
    jest
      .spyOn(service as any, 'buildGrantMapForRecords')
      .mockResolvedValue(new Map())

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

  it('reconciliation page 会回显奖励来源、规则键与冻结奖励配置', async () => {
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
          resolvedRewardRuleKey: 'MONTH_DAY:3',
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
    jest.spyOn(service as any, 'buildGrantMapForRecords').mockResolvedValue(
      new Map([
        [
          '10:2026-04-03',
          [
            {
              id: 201,
              ruleCode: 'streak-3',
              streakDays: 3,
              rewardConfig: { points: 30 },
              triggerSignDate: '2026-04-03',
              grantStatus: CheckInRewardStatusEnum.SUCCESS,
              grantResultType: CheckInRewardResultTypeEnum.APPLIED,
              ledgerIds: [902],
              lastGrantError: null,
            },
          ],
        ],
      ]),
    )

    const result = await service.getReconciliationPage({
      pageIndex: 1,
      pageSize: 20,
    } as any)

    expect(result.list).toEqual([
      expect.objectContaining({
        recordId: 100,
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.PATTERN_RULE,
        resolvedRewardRuleKey: 'MONTH_DAY:3',
        resolvedRewardConfig: { experience: 30 },
        grants: [
          expect.objectContaining({
            ruleCode: 'streak-3',
            streakDays: 3,
            rewardConfig: { points: 30 },
          }),
        ],
      }),
    ])
  })

  it('leaderboard page 会按连续签到天数返回排行榜与用户简要信息', async () => {
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
      rewardDefinition: {
        baseRewardConfig: { points: 5 },
        dateRewardRules: [],
        patternRewardRules: [],
        streakRewardRules: [],
      },
    })
    drizzle.ext.findPagination.mockResolvedValue({
      list: [
        {
          id: 21,
          userId: 11,
          planId: 1,
          cycleKey: 'month-2026-04-01',
          cycleStartDate: '2026-04-01',
          cycleEndDate: '2026-04-30',
          currentStreak: 9,
          lastSignedDate: '2026-04-09',
        },
        {
          id: 20,
          userId: 9,
          planId: 1,
          cycleKey: 'month-2026-04-01',
          cycleStartDate: '2026-04-01',
          cycleEndDate: '2026-04-30',
          currentStreak: 7,
          lastSignedDate: '2026-04-08',
        },
      ],
      total: 2,
      pageIndex: 2,
      pageSize: 2,
    })
    drizzle.db.query.appUser.findMany.mockResolvedValue([
      {
        id: 9,
        nickname: '张三',
        avatarUrl: 'https://cdn.example.com/avatar-9.png',
      },
      {
        id: 11,
        nickname: '李四',
        avatarUrl: null,
      },
    ])

    const result = await service.getLeaderboardPage({
      pageIndex: 2,
      pageSize: 2,
    })

    expect(drizzle.ext.findPagination).toHaveBeenCalledWith(
      schema.checkInCycle,
      expect.objectContaining({
        pageIndex: 2,
        pageSize: 2,
        orderBy: JSON.stringify([
          { currentStreak: 'desc' },
          { lastSignedDate: 'desc' },
          { userId: 'asc' },
        ]),
      }),
    )
    expect(drizzle.db.query.appUser.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [11, 9] },
      },
      columns: {
        id: true,
        nickname: true,
        avatarUrl: true,
      },
    })
    expect(result).toEqual({
      list: [
        {
          rank: 3,
          currentStreak: 9,
          lastSignedDate: '2026-04-09',
          user: {
            id: 11,
            nickname: '李四',
            avatarUrl: undefined,
          },
        },
        {
          rank: 4,
          currentStreak: 7,
          lastSignedDate: '2026-04-08',
          user: {
            id: 9,
            nickname: '张三',
            avatarUrl: 'https://cdn.example.com/avatar-9.png',
          },
        },
      ],
      total: 2,
      pageIndex: 2,
      pageSize: 2,
    })
  })

  it('leaderboard page 在没有生效计划时返回空分页', async () => {
    jest
      .spyOn(service as any, 'findCurrentActivePlan')
      .mockResolvedValue(undefined)

    const result = await service.getLeaderboardPage({
      pageIndex: 0,
      pageSize: 999,
    })

    expect(drizzle.ext.findPagination).not.toHaveBeenCalled()
    expect(drizzle.db.query.appUser.findMany).not.toHaveBeenCalled()
    expect(result).toEqual({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 500,
    })
  })
})
