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
  CheckInRecordTypeEnum,
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

    const detail = await service.getPlanDetail(1)

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
