import {
  checkInCycle,
  checkInPlan,
  checkInRecord,
  checkInStreakRewardGrant,
  checkInStreakRewardRule,
} from '@db/schema'
import { MODULE_METADATA } from '@nestjs/common/constants'
import { getTableConfig } from 'drizzle-orm/pg-core'
import {
  CheckInCycleTypeEnum,
  CheckInPlanStatusEnum,
  CheckInRepairTargetTypeEnum,
  CheckInRecordTypeEnum,
  CheckInRewardResultTypeEnum,
  CheckInRewardStatusEnum,
  CheckInStreakRewardRuleStatusEnum,
} from '../check-in.constant'

jest.mock('@db/core', () => ({
  buildILikeCondition: jest.fn((_column: unknown, value?: string) =>
    value ? { type: 'ilike', value } : undefined,
  ),
  buildLikePattern: jest.fn((value?: string) =>
    value?.trim() ? `%${value.trim()}%` : undefined,
  ),
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/growth/growth-ledger', () => ({
  GrowthAssetTypeEnum: {
    EXPERIENCE: 2,
    POINTS: 1,
  },
  GrowthLedgerActionEnum: {
    GRANT: 1,
  },
  GrowthLedgerModule: class {},
  GrowthLedgerService: class {},
  GrowthLedgerSourceEnum: {
    CHECK_IN_BASE_BONUS: 'check_in_base_bonus',
    CHECK_IN_STREAK_BONUS: 'check_in_streak_bonus',
  },
}))

function createCheckInDrizzleMock(overrides?: Record<string, unknown>) {
  return {
    assertAffectedRows: jest.fn(),
    db: {},
    ext: {
      findPagination: jest.fn(),
    },
    schema: {
      checkInCycle: {
        currentStreak: 'check_in_cycle.current_streak',
        cycleEndDate: 'check_in_cycle.cycle_end_date',
        cycleKey: 'check_in_cycle.cycle_key',
        cycleStartDate: 'check_in_cycle.cycle_start_date',
        id: 'check_in_cycle.id',
        lastSignedDate: 'check_in_cycle.last_signed_date',
        makeupUsedCount: 'check_in_cycle.makeup_used_count',
        planId: 'check_in_cycle.plan_id',
        planSnapshotVersion: 'check_in_cycle.plan_snapshot_version',
        signedCount: 'check_in_cycle.signed_count',
        userId: 'check_in_cycle.user_id',
        version: 'check_in_cycle.version',
      },
      checkInPlan: {
        allowMakeupCountPerCycle: 'check_in_plan.allow_makeup_count_per_cycle',
        baseRewardConfig: 'check_in_plan.base_reward_config',
        cycleType: 'check_in_plan.cycle_type',
        deletedAt: 'check_in_plan.deleted_at',
        endDate: 'check_in_plan.end_date',
        id: 'check_in_plan.id',
        planCode: 'check_in_plan.plan_code',
        planName: 'check_in_plan.plan_name',
        startDate: 'check_in_plan.start_date',
        status: 'check_in_plan.status',
        updatedAt: 'check_in_plan.updated_at',
        updatedById: 'check_in_plan.updated_by_id',
        version: 'check_in_plan.version',
      },
      checkInRecord: {
        cycleId: 'check_in_record.cycle_id',
        id: 'check_in_record.id',
        planId: 'check_in_record.plan_id',
        rewardStatus: 'check_in_record.reward_status',
        signDate: 'check_in_record.sign_date',
        userId: 'check_in_record.user_id',
      },
      checkInStreakRewardGrant: {
        cycleId: 'check_in_streak_reward_grant.cycle_id',
        grantStatus: 'check_in_streak_reward_grant.grant_status',
        id: 'check_in_streak_reward_grant.id',
        ruleId: 'check_in_streak_reward_grant.rule_id',
        triggerSignDate: 'check_in_streak_reward_grant.trigger_sign_date',
        userId: 'check_in_streak_reward_grant.user_id',
      },
      checkInStreakRewardRule: {
        deletedAt: 'check_in_streak_reward_rule.deleted_at',
        id: 'check_in_streak_reward_rule.id',
        planId: 'check_in_streak_reward_rule.plan_id',
        planVersion: 'check_in_streak_reward_rule.plan_version',
        status: 'check_in_streak_reward_rule.status',
        streakDays: 'check_in_streak_reward_rule.streak_days',
      },
    },
    withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
    withTransaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback({}),
    ),
    ...overrides,
  }
}

async function createCheckInDefinitionService(drizzle: unknown) {
  const { CheckInDefinitionService } =
    await import('../check-in-definition.service')

  return new CheckInDefinitionService(drizzle as any, {} as any)
}

async function createCheckInExecutionService(drizzle: unknown) {
  const { CheckInExecutionService } =
    await import('../check-in-execution.service')

  return new CheckInExecutionService(drizzle as any, {} as any)
}

async function createCheckInRuntimeService(drizzle: unknown) {
  const { CheckInRuntimeService } = await import('../check-in-runtime.service')

  return new CheckInRuntimeService(drizzle as any, {} as any)
}

describe('check-in public boundary', () => {
  it('exports only the facade service from CheckInModule', async () => {
    const { CheckInModule } = await import('../check-in.module')
    const { CheckInRuntimeService } = await import('../check-in-runtime.service')
    const { CheckInService } = await import('../check-in.service')

    const exportsMetadata =
      Reflect.getMetadata(MODULE_METADATA.EXPORTS, CheckInModule) ?? []

    expect(exportsMetadata).toContain(CheckInService)
    expect(exportsMetadata).not.toContain(CheckInRuntimeService)
  })

  it('does not re-export CheckInRuntimeService from the public barrel', async () => {
    const publicApi = await import('../index')

    expect(publicApi.CheckInService).toBeDefined()
    expect('CheckInRuntimeService' in publicApi).toBe(false)
  })

  it('keeps execution and runtime helpers out of CheckInDefinitionService', async () => {
    const definitionService = await createCheckInDefinitionService(
      createCheckInDrizzleMock(),
    )
    const executionService = await createCheckInExecutionService(
      createCheckInDrizzleMock(),
    )
    const runtimeService = await createCheckInRuntimeService(
      createCheckInDrizzleMock(),
    )

    expect('resolveEligibleGrantCandidates' in (definitionService as any)).toBe(
      false,
    )
    expect('buildGrantMapForRecords' in (definitionService as any)).toBe(false)
    expect('resolveEligibleGrantCandidates' in (executionService as any)).toBe(
      true,
    )
    expect('buildGrantMapForRecords' in (runtimeService as any)).toBe(true)
  })
})

describe('check-in support contracts', () => {
  const previousTimeZone = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'Asia/Shanghai'
  })

  afterAll(() => {
    if (previousTimeZone === undefined) {
      delete process.env.TZ
      return
    }
    process.env.TZ = previousTimeZone
  })

  it('exposes weekly and monthly only as cycle types', () => {
    expect(Object.values(CheckInCycleTypeEnum)).toEqual([
      CheckInCycleTypeEnum.WEEKLY,
      CheckInCycleTypeEnum.MONTHLY,
    ])
  })

  it('rejects daily as an invalid cycle type', async () => {
    const service = await createCheckInDefinitionService(
      createCheckInDrizzleMock(),
    )

    expect(() => (service as any).parseCycleType('daily')).toThrow(
      '周期类型非法',
    )
  })

  it('freezes plan snapshot fields and versioned streak rules', async () => {
    const service = await createCheckInDefinitionService(
      createCheckInDrizzleMock(),
    )

    expect(
      (service as any).buildPlanSnapshot(
        {
          allowMakeupCountPerCycle: 2,
          baseRewardConfig: { points: 10 },
          cycleType: CheckInCycleTypeEnum.WEEKLY,
          endDate: '2026-05-31',
          id: 1,
          planCode: 'growth-check-in',
          planName: '成长签到',
          startDate: '2026-04-01',
          version: 2,
        },
        [
          {
            id: 11,
            planVersion: 2,
            repeatable: false,
            rewardConfig: { experience: 5 },
            ruleCode: 'streak-3',
            status: CheckInStreakRewardRuleStatusEnum.ENABLED,
            streakDays: 3,
          },
        ],
      ),
    ).toEqual({
      allowMakeupCountPerCycle: 2,
      baseRewardConfig: { points: 10 },
      cycleType: CheckInCycleTypeEnum.WEEKLY,
      endDate: '2026-05-31',
      id: 1,
      planCode: 'growth-check-in',
      planName: '成长签到',
      startDate: '2026-04-01',
      streakRewardRules: [
        {
          id: 11,
          planVersion: 2,
          repeatable: false,
          rewardConfig: { experience: 5 },
          ruleCode: 'streak-3',
          status: CheckInStreakRewardRuleStatusEnum.ENABLED,
          streakDays: 3,
        },
      ],
      version: 2,
    })
  })

  it('builds weekly cycles as rolling seven-day windows from startDate', async () => {
    const service = await createCheckInDefinitionService(
      createCheckInDrizzleMock(),
    )

    expect(
      (service as any).buildCycleFrame(
        {
          cycleType: CheckInCycleTypeEnum.WEEKLY,
          startDate: '2026-04-01',
        },
        new Date('2026-04-10T12:00:00.000Z'),
      ),
    ).toEqual({
      cycleEndDate: '2026-04-14',
      cycleKey: 'week-2026-04-08',
      cycleStartDate: '2026-04-08',
    })
  })

  it('resolves all missing thresholds in one recompute and keeps repeatable grants independent', async () => {
    const service = await createCheckInExecutionService(
      createCheckInDrizzleMock(),
    )

    expect(
      (service as any).resolveEligibleGrantCandidates(
        [
          {
            id: 31,
            repeatable: false,
            rewardConfig: { points: 30 },
            ruleCode: 'streak-3',
            status: CheckInStreakRewardRuleStatusEnum.ENABLED,
            streakDays: 3,
          },
          {
            id: 71,
            repeatable: false,
            rewardConfig: { points: 70 },
            ruleCode: 'streak-7',
            status: CheckInStreakRewardRuleStatusEnum.ENABLED,
            streakDays: 7,
          },
        ],
        {
          '2026-04-01': 1,
          '2026-04-02': 2,
          '2026-04-03': 3,
          '2026-04-04': 4,
          '2026-04-05': 5,
          '2026-04-06': 6,
          '2026-04-07': 7,
        },
        [],
      ),
    ).toEqual([
      {
        rule: expect.objectContaining({ id: 31 }),
        triggerSignDate: '2026-04-03',
      },
      {
        rule: expect.objectContaining({ id: 71 }),
        triggerSignDate: '2026-04-07',
      },
    ])

    expect(
      (service as any).resolveEligibleGrantCandidates(
        [
          {
            id: 32,
            repeatable: true,
            rewardConfig: { points: 30 },
            ruleCode: 'streak-3-repeatable',
            status: CheckInStreakRewardRuleStatusEnum.ENABLED,
            streakDays: 3,
          },
        ],
        {
          '2026-04-01': 1,
          '2026-04-02': 2,
          '2026-04-03': 3,
          '2026-04-04': 1,
          '2026-04-05': 2,
          '2026-04-06': 3,
        },
        [{ ruleId: 32, triggerSignDate: '2026-04-03' }],
      ),
    ).toEqual([
      {
        rule: expect.objectContaining({ id: 32 }),
        triggerSignDate: '2026-04-06',
      },
    ])
  })
})

describe('check-in definition service versioning', () => {
  const currentPlan = {
    allowMakeupCountPerCycle: 1,
    baseRewardConfig: { points: 10 },
    cycleType: CheckInCycleTypeEnum.WEEKLY,
    endDate: null,
    id: 1,
    planCode: 'growth-check-in',
    planName: '成长签到',
    startDate: '2026-04-01',
    status: CheckInPlanStatusEnum.DRAFT,
    version: 1,
  }
  const currentRules = [
    {
      id: 11,
      planVersion: 1,
      repeatable: false,
      rewardConfig: { points: 30 },
      ruleCode: 'streak-3',
      status: CheckInStreakRewardRuleStatusEnum.ENABLED,
      streakDays: 3,
    },
  ]

  it('bumps version and writes new-version rules only for critical config changes', async () => {
    const where = jest.fn().mockResolvedValue({ rowCount: 1 })
    const set = jest.fn(() => ({ where }))
    const update = jest.fn(() => ({ set }))
    const values = jest.fn().mockResolvedValue(undefined)
    const insert = jest.fn(() => ({ values }))
    const drizzle = createCheckInDrizzleMock({
      withTransaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
        callback({ insert, update }),
      ),
    })

    const service = await createCheckInDefinitionService(drizzle)
    jest.spyOn(service as any, 'getPlanById').mockResolvedValue(currentPlan)
    jest.spyOn(service as any, 'getPlanRules').mockResolvedValue(currentRules)

    await service.updatePlan({ allowMakeupCountPerCycle: 2, id: 1 }, 9)

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        allowMakeupCountPerCycle: 2,
        updatedById: 9,
        version: 2,
      }),
    )
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({
        planId: 1,
        planVersion: 2,
        ruleCode: 'streak-3',
        streakDays: 3,
      }),
    ])
  })

  it('keeps the current version for non-critical display changes', async () => {
    const where = jest.fn().mockResolvedValue({ rowCount: 1 })
    const set = jest.fn(() => ({ where }))
    const update = jest.fn(() => ({ set }))
    const values = jest.fn().mockResolvedValue(undefined)
    const insert = jest.fn(() => ({ values }))
    const drizzle = createCheckInDrizzleMock({
      withTransaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
        callback({ insert, update }),
      ),
    })

    const service = await createCheckInDefinitionService(drizzle)
    jest.spyOn(service as any, 'getPlanById').mockResolvedValue(currentPlan)
    jest.spyOn(service as any, 'getPlanRules').mockResolvedValue(currentRules)

    await service.updatePlan({ id: 1, planName: '成长签到（新版文案）' }, 9)

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        planName: '成长签到（新版文案）',
        version: 1,
      }),
    )
    expect(insert).not.toHaveBeenCalled()
  })

  it('blocks creating a second active published plan', async () => {
    const drizzle = createCheckInDrizzleMock({
      withTransaction: jest.fn(),
    })
    const service = await createCheckInDefinitionService(drizzle)
    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue({
      id: 99,
    })

    await expect(
      service.createPlan(
        {
          allowMakeupCountPerCycle: 1,
          baseRewardConfig: { points: 10 },
          cycleType: CheckInCycleTypeEnum.WEEKLY,
          endDate: null,
          planCode: 'growth-check-in',
          planName: '成长签到',
          startDate: '2026-04-01',
          status: CheckInPlanStatusEnum.PUBLISHED,
        } as any,
        9,
      ),
    ).rejects.toThrow('当前已有其他生效中的签到计划')

    expect(drizzle.withTransaction).not.toHaveBeenCalled()
  })

  it('returns persisted status directly in detail view', async () => {
    const service = await createCheckInDefinitionService(
      createCheckInDrizzleMock(),
    )

    jest.spyOn(service as any, 'getPlanById').mockResolvedValue({
      ...currentPlan,
      status: CheckInPlanStatusEnum.DISABLED,
    })
    jest.spyOn(service as any, 'getPlanRules').mockResolvedValue(currentRules)
    jest.spyOn(service as any, 'buildPlanSummary').mockResolvedValue({
      activeCycleCount: 0,
      pendingRewardCount: 0,
      ruleCount: 1,
    })

    const detail = await service.getPlanDetail({ id: 1 })

    expect(detail).toEqual(
      expect.objectContaining({
        status: CheckInPlanStatusEnum.DISABLED,
      }),
    )
  })

  it('persists plan status as a single status field', async () => {
    const service = await createCheckInDefinitionService(
      createCheckInDrizzleMock(),
    )

    expect(
      (service as any).buildPlanStatusPersistence(
        CheckInPlanStatusEnum.DISABLED,
      ),
    ).toEqual({
      status: CheckInPlanStatusEnum.DISABLED,
    })
  })

  it('treats plan start and end dates as inclusive active boundaries', async () => {
    const service = await createCheckInDefinitionService(
      createCheckInDrizzleMock(),
    )

    expect(
      (service as any).isPlanActiveAt(
        {
          endDate: '2026-04-02',
          startDate: '2026-04-01',
          status: CheckInPlanStatusEnum.PUBLISHED,
        },
        new Date('2026-04-02T12:00:00.000Z'),
      ),
    ).toBe(true)

    expect(
      (service as any).isPlanActiveAt(
        {
          endDate: '2026-04-02',
          startDate: '2026-04-03',
          status: CheckInPlanStatusEnum.PUBLISHED,
        },
        new Date('2026-04-02T12:00:00.000Z'),
      ),
    ).toBe(false)

    expect(
      (service as any).isPlanActiveAt(
        {
          endDate: '2026-04-01',
          startDate: '2026-03-20',
          status: CheckInPlanStatusEnum.PUBLISHED,
        },
        new Date('2026-04-02T12:00:00.000Z'),
      ),
    ).toBe(false)
  })
})

describe('check-in execution response contract', () => {
  it('preserves idempotent flags when the sign record already exists', async () => {
    const drizzle = createCheckInDrizzleMock({
      withTransaction: jest.fn().mockResolvedValue({
        alreadyExisted: true,
        currentStreak: 3,
        cycleId: 10,
        recordId: 100,
        recordType: CheckInRecordTypeEnum.NORMAL,
        remainingMakeupCount: 1,
        rewardResultType: null,
        rewardStatus: null,
        signDate: '2026-04-01',
        signedCount: 3,
        triggeredGrantIds: [],
      }),
    })
    const service = await createCheckInExecutionService(drizzle)

    jest
      .spyOn(service as any, 'buildLatestActionView')
      .mockImplementation(
        async (_recordId: number, meta: Record<string, unknown>) => ({
          alreadyExisted: meta.alreadyExisted,
          currentStreak: 3,
          cycleId: 10,
          recordId: 100,
          recordType: CheckInRecordTypeEnum.NORMAL,
          remainingMakeupCount: 1,
          rewardResultType: null,
          rewardStatus: null,
          signDate: '2026-04-01',
          signedCount: 3,
          triggeredGrantIds: meta.triggeredGrantIds,
        }),
      )
    jest.spyOn(service as any, 'formatDateOnly').mockReturnValue('2026-04-01')
    jest
      .spyOn(service as any, 'getCurrentActivePlan')
      .mockResolvedValue({ id: 1 })
    const settleRecordReward = jest
      .spyOn(service as any, 'settleRecordReward')
      .mockResolvedValue(true)
    const settleGrantReward = jest
      .spyOn(service as any, 'settleGrantReward')
      .mockResolvedValue(true)

    await expect(service.signToday(9)).resolves.toMatchObject({
      alreadyExisted: true,
      triggeredGrantIds: [],
    })
    expect(settleRecordReward).not.toHaveBeenCalled()
    expect(settleGrantReward).not.toHaveBeenCalled()
    expect((service as any).buildLatestActionView).toHaveBeenCalledWith(100, {
      alreadyExisted: true,
      triggeredGrantIds: [],
    })
  })

  it('preserves newly triggered grant ids after reward settlement', async () => {
    const drizzle = createCheckInDrizzleMock({
      withTransaction: jest.fn().mockResolvedValue({
        alreadyExisted: false,
        currentStreak: 3,
        cycleId: 10,
        recordId: 101,
        recordType: CheckInRecordTypeEnum.NORMAL,
        remainingMakeupCount: 1,
        rewardResultType: null,
        rewardStatus: null,
        signDate: '2026-04-01',
        signedCount: 3,
        triggeredGrantIds: [201, 202],
      }),
    })
    const service = await createCheckInExecutionService(drizzle)

    jest
      .spyOn(service as any, 'buildLatestActionView')
      .mockImplementation(
        async (_recordId: number, meta: Record<string, unknown>) => ({
          alreadyExisted: meta.alreadyExisted,
          currentStreak: 3,
          cycleId: 10,
          recordId: 101,
          recordType: CheckInRecordTypeEnum.NORMAL,
          remainingMakeupCount: 1,
          rewardResultType: null,
          rewardStatus: null,
          signDate: '2026-04-01',
          signedCount: 3,
          triggeredGrantIds: meta.triggeredGrantIds,
        }),
      )
    jest.spyOn(service as any, 'formatDateOnly').mockReturnValue('2026-04-01')
    jest
      .spyOn(service as any, 'getCurrentActivePlan')
      .mockResolvedValue({ id: 1 })
    const settleRecordReward = jest
      .spyOn(service as any, 'settleRecordReward')
      .mockResolvedValue(true)
    const settleGrantReward = jest
      .spyOn(service as any, 'settleGrantReward')
      .mockResolvedValue(true)

    await expect(service.signToday(9)).resolves.toMatchObject({
      alreadyExisted: false,
      triggeredGrantIds: [201, 202],
    })
    expect(settleRecordReward).toHaveBeenCalledWith(101, {
      source: 'record_reward',
    })
    expect(settleGrantReward).toHaveBeenNthCalledWith(1, 201, {
      source: 'streak_reward',
    })
    expect(settleGrantReward).toHaveBeenNthCalledWith(2, 202, {
      source: 'streak_reward',
    })
  })
})

describe('check-in runtime public behavior', () => {
  const previousTimeZone = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'Asia/Shanghai'
  })

  afterAll(() => {
    if (previousTimeZone === undefined) {
      delete process.env.TZ
      return
    }
    process.env.TZ = previousTimeZone
  })

  it('returns empty summary when no active plan exists', async () => {
    const service = await createCheckInRuntimeService(createCheckInDrizzleMock())

    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue(null)

    await expect(service.getSummary(9)).resolves.toEqual({
      plan: null,
      cycle: null,
      todaySigned: false,
      nextStreakReward: null,
      latestRecord: null,
    })
  })

  it('builds summary from active cycle snapshot and latest record', async () => {
    const service = await createCheckInRuntimeService(createCheckInDrizzleMock())
    const latestGrant = {
      id: 201,
      ruleId: 31,
      triggerSignDate: '2026-04-03',
      grantStatus: CheckInRewardStatusEnum.SUCCESS,
      grantResultType: CheckInRewardResultTypeEnum.APPLIED,
      ledgerIds: [701],
      lastGrantError: null,
    }

    jest.spyOn(service as any, 'formatDateOnly').mockReturnValue('2026-04-03')
    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue({
      id: 1,
      planCode: 'growth-check-in',
      planName: '成长签到',
      status: CheckInPlanStatusEnum.PUBLISHED,
      cycleType: CheckInCycleTypeEnum.WEEKLY,
      startDate: '2026-04-01',
      endDate: null,
      allowMakeupCountPerCycle: 2,
    })
    jest.spyOn(service as any, 'getCurrentCycleView').mockResolvedValue({
      id: 10,
      cycleKey: 'week-2026-04-01',
      cycleStartDate: '2026-04-01',
      cycleEndDate: '2026-04-07',
      signedCount: 2,
      makeupUsedCount: 1,
      currentStreak: 2,
      lastSignedDate: '2026-04-03',
      planSnapshotVersion: 1,
      planSnapshot: {
        allowMakeupCountPerCycle: 2,
        baseRewardConfig: { points: 10 },
        streakRewardRules: [
          {
            id: 31,
            planVersion: 1,
            repeatable: false,
            rewardConfig: { points: 30 },
            ruleCode: 'streak-3',
            status: CheckInStreakRewardRuleStatusEnum.ENABLED,
            streakDays: 3,
          },
        ],
      },
    })
    jest.spyOn(service as any, 'listCycleRecords').mockResolvedValue([
      {
        id: 101,
        cycleId: 10,
        signDate: '2026-04-03',
        recordType: CheckInRecordTypeEnum.NORMAL,
        rewardStatus: CheckInRewardStatusEnum.SUCCESS,
        rewardResultType: CheckInRewardResultTypeEnum.APPLIED,
        baseRewardLedgerIds: [501],
        lastRewardError: null,
        rewardSettledAt: new Date('2026-04-03T00:00:00.000Z'),
        createdAt: new Date('2026-04-03T00:00:00.000Z'),
      },
    ])
    jest.spyOn(service as any, 'buildGrantMapForRecords').mockResolvedValue(
      new Map([['10:2026-04-03', [latestGrant]]]),
    )

    await expect(service.getSummary(9)).resolves.toEqual(
      expect.objectContaining({
        plan: expect.objectContaining({
          id: 1,
          planCode: 'growth-check-in',
          baseRewardConfig: { points: 10 },
        }),
        cycle: expect.objectContaining({
          id: 10,
          signedCount: 2,
          remainingMakeupCount: 1,
          currentStreak: 2,
        }),
        todaySigned: true,
        nextStreakReward: expect.objectContaining({
          id: 31,
          streakDays: 3,
        }),
        latestRecord: expect.objectContaining({
          id: 101,
          signDate: '2026-04-03',
          grants: [latestGrant],
        }),
      }),
    )
  })

  it('builds calendar placeholders for unsigned and future dates in the current cycle', async () => {
    const service = await createCheckInRuntimeService(createCheckInDrizzleMock())

    jest.spyOn(service as any, 'formatDateOnly').mockReturnValue('2026-04-02')
    jest.spyOn(service as any, 'getAppTimeZone').mockReturnValue('Asia/Shanghai')
    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue({
      id: 1,
    })
    jest.spyOn(service as any, 'getCurrentCycleView').mockResolvedValue({
      id: 10,
      cycleKey: 'week-2026-04-01',
      cycleStartDate: '2026-04-01',
      cycleEndDate: '2026-04-03',
      signedCount: 1,
      makeupUsedCount: 0,
      currentStreak: 1,
      planSnapshotVersion: 1,
      planSnapshot: {
        allowMakeupCountPerCycle: 1,
        baseRewardConfig: null,
        streakRewardRules: [],
      },
    })
    jest.spyOn(service as any, 'listCycleRecords').mockResolvedValue([
      {
        id: 101,
        cycleId: 10,
        signDate: '2026-04-02',
        recordType: CheckInRecordTypeEnum.NORMAL,
        rewardStatus: CheckInRewardStatusEnum.SUCCESS,
        rewardResultType: CheckInRewardResultTypeEnum.APPLIED,
        baseRewardLedgerIds: [],
        lastRewardError: null,
        rewardSettledAt: new Date('2026-04-02T00:00:00.000Z'),
        createdAt: new Date('2026-04-02T00:00:00.000Z'),
      },
    ])
    jest.spyOn(service as any, 'buildGrantMapForRecords').mockResolvedValue(
      new Map(),
    )

    await expect(service.getCalendar(9)).resolves.toEqual({
      planId: 1,
      cycleId: 10,
      cycleKey: 'week-2026-04-01',
      cycleStartDate: '2026-04-01',
      cycleEndDate: '2026-04-03',
      days: [
        {
          signDate: '2026-04-01',
          isToday: false,
          isFuture: false,
          isSigned: false,
          recordType: undefined,
          rewardStatus: undefined,
          rewardResultType: undefined,
          grantCount: 0,
        },
        {
          signDate: '2026-04-02',
          isToday: true,
          isFuture: false,
          isSigned: true,
          recordType: CheckInRecordTypeEnum.NORMAL,
          rewardStatus: CheckInRewardStatusEnum.SUCCESS,
          rewardResultType: CheckInRewardResultTypeEnum.APPLIED,
          grantCount: 0,
        },
        {
          signDate: '2026-04-03',
          isToday: false,
          isFuture: true,
          isSigned: false,
          recordType: undefined,
          rewardStatus: undefined,
          rewardResultType: undefined,
          grantCount: 0,
        },
      ],
    })
  })

  it('uses stable default ordering and attaches grant views in my record pages', async () => {
    const drizzle = createCheckInDrizzleMock({
      ext: {
        findPagination: jest.fn().mockResolvedValue({
          list: [
            {
              id: 101,
              cycleId: 10,
              signDate: '2026-04-03',
              recordType: CheckInRecordTypeEnum.NORMAL,
              rewardStatus: CheckInRewardStatusEnum.SUCCESS,
              rewardResultType: CheckInRewardResultTypeEnum.APPLIED,
              baseRewardLedgerIds: [501],
              lastRewardError: null,
              rewardSettledAt: new Date('2026-04-03T00:00:00.000Z'),
              createdAt: new Date('2026-04-03T00:00:00.000Z'),
            },
          ],
          pageIndex: 1,
          pageSize: 20,
          total: 1,
        }),
      },
    })
    const service = await createCheckInRuntimeService(drizzle)
    const grant = {
      id: 201,
      ruleId: 31,
      triggerSignDate: '2026-04-03',
      grantStatus: CheckInRewardStatusEnum.SUCCESS,
      grantResultType: CheckInRewardResultTypeEnum.APPLIED,
      ledgerIds: [701],
      lastGrantError: null,
    }

    jest.spyOn(service as any, 'buildGrantMapForRecords').mockResolvedValue(
      new Map([['10:2026-04-03', [grant]]]),
    )

    const page = await service.getMyRecords(
      { pageIndex: 1, pageSize: 20 } as any,
      9,
    )

    expect(drizzle.ext.findPagination).toHaveBeenCalledWith(
      drizzle.schema.checkInRecord,
      expect.objectContaining({
        orderBy: JSON.stringify([{ signDate: 'desc' }, { id: 'desc' }]),
      }),
    )
    expect(page.list).toEqual([
      expect.objectContaining({
        id: 101,
        signDate: '2026-04-03',
        grants: [grant],
      }),
    ])
  })

  it('uses stable default ordering and maps reconciliation rows with grants', async () => {
    const drizzle = createCheckInDrizzleMock({
      ext: {
        findPagination: jest.fn().mockResolvedValue({
          list: [
            {
              id: 101,
              userId: 9,
              planId: 1,
              cycleId: 10,
              signDate: '2026-04-03',
              recordType: CheckInRecordTypeEnum.NORMAL,
              rewardStatus: CheckInRewardStatusEnum.FAILED,
              rewardResultType: CheckInRewardResultTypeEnum.FAILED,
              baseRewardLedgerIds: [],
              lastRewardError: '签到基础奖励发放失败',
              createdAt: new Date('2026-04-03T00:00:00.000Z'),
            },
          ],
          pageIndex: 1,
          pageSize: 20,
          total: 1,
        }),
      },
    })
    const service = await createCheckInRuntimeService(drizzle)
    const grant = {
      id: 201,
      ruleId: 31,
      triggerSignDate: '2026-04-03',
      grantStatus: CheckInRewardStatusEnum.PENDING,
      grantResultType: null,
      ledgerIds: [],
      lastGrantError: null,
    }

    jest.spyOn(service as any, 'buildGrantMapForRecords').mockResolvedValue(
      new Map([['10:2026-04-03', [grant]]]),
    )

    const page = await service.getReconciliationPage({
      pageIndex: 1,
      pageSize: 20,
    } as any)

    expect(drizzle.ext.findPagination).toHaveBeenCalledWith(
      drizzle.schema.checkInRecord,
      expect.objectContaining({
        orderBy: JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }]),
      }),
    )
    expect(page.list).toEqual([
      expect.objectContaining({
        recordId: 101,
        userId: 9,
        planId: 1,
        cycleId: 10,
        signDate: '2026-04-03',
        grants: [grant],
      }),
    ])
  })
})

describe('check-in execution public behavior', () => {
  it('rejects makeup on today before querying the current active plan', async () => {
    const service = await createCheckInExecutionService(createCheckInDrizzleMock())
    const getCurrentActivePlan = jest.spyOn(
      service as any,
      'getCurrentActivePlan',
    )

    jest.spyOn(service as any, 'parseDateOnly').mockReturnValue('2026-04-03')
    jest.spyOn(service as any, 'formatDateOnly').mockReturnValue('2026-04-03')

    await expect(service.makeup({ signDate: '2026-04-03' } as any, 9)).rejects
      .toThrow('补签只能发生在今天之前')
    expect(getCurrentActivePlan).not.toHaveBeenCalled()
  })

  it('routes record reward repair through record settlement with actor context', async () => {
    const service = await createCheckInExecutionService(createCheckInDrizzleMock())
    const settleRecordReward = jest
      .spyOn(service as any, 'settleRecordReward')
      .mockResolvedValue(true)

    await expect(
      service.repairReward(
        {
          targetType: CheckInRepairTargetTypeEnum.RECORD_REWARD,
          recordId: 101,
        } as any,
        9,
      ),
    ).resolves.toEqual({
      targetType: CheckInRepairTargetTypeEnum.RECORD_REWARD,
      recordId: 101,
      success: true,
    })
    expect(settleRecordReward).toHaveBeenCalledWith(101, {
      actorUserId: 9,
      source: 'admin_repair',
    })
  })

  it('routes streak reward repair through grant settlement with actor context', async () => {
    const service = await createCheckInExecutionService(createCheckInDrizzleMock())
    const settleGrantReward = jest
      .spyOn(service as any, 'settleGrantReward')
      .mockResolvedValue(true)

    await expect(
      service.repairReward(
        {
          targetType: CheckInRepairTargetTypeEnum.STREAK_GRANT,
          grantId: 201,
        } as any,
        9,
      ),
    ).resolves.toEqual({
      targetType: CheckInRepairTargetTypeEnum.STREAK_GRANT,
      grantId: 201,
      success: true,
    })
    expect(settleGrantReward).toHaveBeenCalledWith(201, {
      actorUserId: 9,
      source: 'admin_repair',
    })
  })

  it('validates reward repair target ids before entering settlement', async () => {
    const service = await createCheckInExecutionService(createCheckInDrizzleMock())

    await expect(
      service.repairReward(
        {
          targetType: CheckInRepairTargetTypeEnum.RECORD_REWARD,
        } as any,
        9,
      ),
    ).rejects.toThrow('recordId 不能为空')

    await expect(
      service.repairReward(
        {
          targetType: CheckInRepairTargetTypeEnum.STREAK_GRANT,
        } as any,
        9,
      ),
    ).rejects.toThrow('grantId 不能为空')
  })

  it('guards makeup dates against cycle boundary and unsupported plans', async () => {
    const service = await createCheckInExecutionService(createCheckInDrizzleMock())

    expect(() =>
      (service as any).assertMakeupAllowed(
        '2026-03-31',
        '2026-04-03',
        {
          cycleStartDate: '2026-04-01',
          cycleEndDate: '2026-04-07',
        },
        {
          allowMakeupCountPerCycle: 1,
        },
      ),
    ).toThrow('补签日期不在当前周期内')

    expect(() =>
      (service as any).assertMakeupAllowed(
        '2026-04-02',
        '2026-04-03',
        {
          cycleStartDate: '2026-04-01',
          cycleEndDate: '2026-04-07',
        },
        {
          allowMakeupCountPerCycle: 0,
        },
      ),
    ).toThrow('当前计划不支持补签')
  })

  it('keeps reward status empty when building a non-reward sign record', async () => {
    const service = await createCheckInExecutionService(createCheckInDrizzleMock())

    expect(
      (service as any).buildRecordInsert({
        userId: 9,
        planId: 1,
        cycleId: 10,
        cycleKey: 'week-2026-04-01',
        signDate: '2026-04-03',
        recordType: CheckInRecordTypeEnum.NORMAL,
        operatorType: 1,
        rewardApplicable: false,
        context: { source: 'app_sign' },
      }),
    ).toEqual(
      expect.objectContaining({
        userId: 9,
        planId: 1,
        cycleId: 10,
        signDate: '2026-04-03',
        rewardStatus: null,
        bizKey: 'checkin:record:plan:1:cycle:week-2026-04-01:user:9:date:2026-04-03',
      }),
    )
  })

  it('treats all-duplicated ledger writes as idempotent reward results', async () => {
    const service = await createCheckInExecutionService(createCheckInDrizzleMock())

    expect(
      (service as any).resolveRewardResultType([
        { duplicated: true },
        { duplicated: true },
      ]),
    ).toBe(CheckInRewardResultTypeEnum.IDEMPOTENT)
  })
})

describe('check-in schema constraints', () => {
  it('declares strict plan and cycle check constraints', () => {
    expect(getTableConfig(checkInPlan).checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'check_in_plan_status_valid_chk',
        'check_in_plan_cycle_type_valid_chk',
      ]),
    )

    expect(getTableConfig(checkInCycle).checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'check_in_cycle_version_non_negative_chk',
        'check_in_cycle_last_signed_date_in_cycle_chk',
        'check_in_cycle_current_streak_not_gt_signed_count_chk',
        'check_in_cycle_makeup_used_count_not_gt_signed_count_chk',
        'check_in_cycle_signed_count_not_gt_cycle_days_chk',
      ]),
    )
  })

  it('declares strict record, grant, and rule check constraints', () => {
    expect(getTableConfig(checkInRecord).checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'check_in_record_record_type_valid_chk',
        'check_in_record_reward_status_valid_chk',
        'check_in_record_reward_result_type_valid_chk',
        'check_in_record_operator_type_valid_chk',
        'check_in_record_reward_state_consistent_chk',
      ]),
    )

    expect(
      getTableConfig(checkInStreakRewardGrant).checks.map(({ name }) => name),
    ).toEqual(
      expect.arrayContaining([
        'check_in_streak_grant_status_valid_chk',
        'check_in_streak_grant_result_type_valid_chk',
        'check_in_streak_grant_state_consistent_chk',
      ]),
    )

    expect(
      getTableConfig(checkInStreakRewardRule).checks.map(({ name }) => name),
    ).toEqual(
      expect.arrayContaining([
        'check_in_streak_rule_status_valid_chk',
      ]),
    )
  })
})
