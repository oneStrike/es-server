import {
  CheckInCycleTypeEnum,
  CheckInPlanStatusEnum,
  CheckInRecordTypeEnum,
  CheckInStreakRewardRuleStatusEnum,
} from '../check-in.constant'

jest.mock('@db/core', () => ({
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
        cycleAnchorDate: 'check_in_plan.cycle_anchor_date',
        cycleType: 'check_in_plan.cycle_type',
        deletedAt: 'check_in_plan.deleted_at',
        id: 'check_in_plan.id',
        isEnabled: 'check_in_plan.is_enabled',
        planCode: 'check_in_plan.plan_code',
        planName: 'check_in_plan.plan_name',
        publishEndAt: 'check_in_plan.publish_end_at',
        publishStartAt: 'check_in_plan.publish_start_at',
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
        sortOrder: 'check_in_streak_reward_rule.sort_order',
        status: 'check_in_streak_reward_rule.status',
        streakDays: 'check_in_streak_reward_rule.streak_days',
      },
    },
    withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
    withTransaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback({})),
    ...overrides,
  }
}

async function createCheckInDefinitionService(drizzle: unknown) {
  const { CheckInDefinitionService } = await import('../check-in-definition.service')

  return new CheckInDefinitionService(drizzle as any, {} as any)
}

async function createCheckInExecutionService(drizzle: unknown) {
  const { CheckInExecutionService } = await import('../check-in-execution.service')

  return new CheckInExecutionService(drizzle as any, {} as any)
}

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

  it('freezes plan snapshot fields and versioned streak rules', async () => {
    const service = await createCheckInDefinitionService(createCheckInDrizzleMock())

    expect(
      (service as any).buildPlanSnapshot(
        {
          allowMakeupCountPerCycle: 2,
          baseRewardConfig: { points: 10 },
          cycleAnchorDate: '2026-04-01',
          cycleType: CheckInCycleTypeEnum.WEEKLY,
          id: 1,
          planCode: 'daily-check-in',
          planName: '每日签到',
          version: 2,
        },
        [
          {
            id: 11,
            planVersion: 2,
            repeatable: false,
            rewardConfig: { experience: 5 },
            ruleCode: 'streak-3',
            sortOrder: 3,
            status: CheckInStreakRewardRuleStatusEnum.ENABLED,
            streakDays: 3,
          },
        ],
      ),
    ).toEqual({
      allowMakeupCountPerCycle: 2,
      baseRewardConfig: { points: 10 },
      cycleAnchorDate: '2026-04-01',
      cycleType: CheckInCycleTypeEnum.WEEKLY,
      id: 1,
      planCode: 'daily-check-in',
      planName: '每日签到',
      streakRewardRules: [
        {
          id: 11,
          planVersion: 2,
          repeatable: false,
          rewardConfig: { experience: 5 },
          ruleCode: 'streak-3',
          sortOrder: 3,
          status: CheckInStreakRewardRuleStatusEnum.ENABLED,
          streakDays: 3,
        },
      ],
      version: 2,
    })
  })

  it('resolves all missing thresholds in one recompute and keeps repeatable grants independent', async () => {
    const service = await createCheckInDefinitionService(createCheckInDrizzleMock())

    expect(
      (service as any).resolveEligibleGrantCandidates(
        [
          {
            id: 31,
            repeatable: false,
            rewardConfig: { points: 30 },
            ruleCode: 'streak-3',
            sortOrder: 3,
            status: CheckInStreakRewardRuleStatusEnum.ENABLED,
            streakDays: 3,
          },
          {
            id: 71,
            repeatable: false,
            rewardConfig: { points: 70 },
            ruleCode: 'streak-7',
            sortOrder: 7,
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
            sortOrder: 3,
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
    cycleAnchorDate: '2026-04-01',
    cycleType: CheckInCycleTypeEnum.WEEKLY,
    id: 1,
    isEnabled: true,
    planCode: 'daily-check-in',
    planName: '每日签到',
    publishEndAt: null,
    publishStartAt: null,
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
      sortOrder: 3,
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
        callback({ insert, update })),
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
        callback({ insert, update })),
    })

    const service = await createCheckInDefinitionService(drizzle)
    jest.spyOn(service as any, 'getPlanById').mockResolvedValue(currentPlan)
    jest.spyOn(service as any, 'getPlanRules').mockResolvedValue(currentRules)

    await service.updatePlan({ id: 1, planName: '每日签到（新版文案）' }, 9)

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        planName: '每日签到（新版文案）',
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
          cycleAnchorDate: '2026-04-01',
          cycleType: CheckInCycleTypeEnum.WEEKLY,
          isEnabled: true,
          planCode: 'daily-check-in',
          planName: '每日签到',
          status: CheckInPlanStatusEnum.PUBLISHED,
        } as any,
        9,
      ),
    ).rejects.toThrow('当前已有其他生效中的签到计划')

    expect(drizzle.withTransaction).not.toHaveBeenCalled()
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
      .mockImplementation(async (_recordId: number, meta: Record<string, unknown>) => ({
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
      }))
    jest.spyOn(service as any, 'formatDateOnly').mockReturnValue('2026-04-01')
    jest.spyOn(service as any, 'getCurrentActivePlan').mockResolvedValue({ id: 1 })
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
      .mockImplementation(async (_recordId: number, meta: Record<string, unknown>) => ({
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
      }))
    jest.spyOn(service as any, 'formatDateOnly').mockReturnValue('2026-04-01')
    jest.spyOn(service as any, 'getCurrentActivePlan').mockResolvedValue({ id: 1 })
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
    expect(settleRecordReward).toHaveBeenCalledWith(101, { source: 'record_reward' })
    expect(settleGrantReward).toHaveBeenNthCalledWith(1, 201, {
      source: 'streak_reward',
    })
    expect(settleGrantReward).toHaveBeenNthCalledWith(2, 202, {
      source: 'streak_reward',
    })
  })
})
