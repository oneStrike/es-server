import { checkInConfig, checkInStreakRule, checkInStreakRuleRewardItem } from '@db/schema'
import { startOfNextDayInAppTimeZone } from '@libs/platform/utils'
import { CheckInMakeupService } from './check-in-makeup.service'
import {
  CheckInMakeupPeriodTypeEnum,
  CheckInStreakConfigStatusEnum,
  CheckInStreakPublishStrategyEnum,
} from './check-in.constant'
import { CheckInDefinitionService } from './check-in-definition.service'
import { CheckInRewardPolicyService } from './check-in-reward-policy.service'
import { CheckInStreakService } from './check-in-streak.service'

describe('check-in definition service orchestration', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T04:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  function createService(
    currentConfig:
      | Partial<{
          id: number
          isEnabled: number
          makeupPeriodType: number
          periodicAllowance: number
          baseRewardItems: unknown
          dateRewardRules: unknown
          patternRewardRules: unknown
          updatedById: number | null
          createdAt: Date
          updatedAt: Date
        }>
      | null = {},
  ) {
    const insertValues = jest.fn().mockResolvedValue(undefined)
    const updateWhere = jest.fn().mockResolvedValue(undefined)
    const updateSet = jest.fn().mockReturnValue({
      where: updateWhere,
    })
    const drizzle = {
      schema: {
        checkInConfig,
      },
      db: {
        insert: jest.fn().mockReturnValue({
          values: insertValues,
        }),
        update: jest.fn().mockReturnValue({
          set: updateSet,
        }),
      },
    }
    const rewardPolicyService = new CheckInRewardPolicyService(
      {} as never,
      {} as never,
    )
    const makeupService = new CheckInMakeupService({} as never, {} as never)

    const service = new CheckInDefinitionService(
      drizzle as never,
      {} as never,
      makeupService,
      rewardPolicyService,
      {} as never,
    )

    ;(
      service as unknown as {
        getRequiredConfig: () => Promise<{ id: number }>
      }
    ).getRequiredConfig = jest.fn().mockResolvedValue({ id: 5 })
    ;(
      service as unknown as {
        getCurrentConfig: () => Promise<{
          id: number
          isEnabled: number
          makeupPeriodType: number
          periodicAllowance: number
          baseRewardItems: unknown
          dateRewardRules: unknown
          patternRewardRules: unknown
          updatedById: number | null
          createdAt: Date
          updatedAt: Date
        } | null>
      }
    ).getCurrentConfig = jest.fn().mockResolvedValue(
      currentConfig === null
        ? null
        : {
            id: 5,
            isEnabled: 1,
            makeupPeriodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
            periodicAllowance: 2,
            baseRewardItems: null,
            dateRewardRules: [],
            patternRewardRules: [],
            updatedById: null,
            createdAt: new Date('2026-04-20T00:00:00.000Z'),
            updatedAt: new Date('2026-04-23T00:00:00.000Z'),
            ...currentConfig,
          },
    )

    return {
      service,
      drizzle,
      insertValues,
      updateSet,
    }
  }

  it('updates enabled flag without touching unrelated config fields', async () => {
    const { service, drizzle } = createService()

    await expect(
      service.updateEnabled(
        {
          isEnabled: true,
        } as never,
        99,
      ),
    ).resolves.toBe(true)

    expect(drizzle.db.update).toHaveBeenCalled()
  })

  it('preserves past date rewards while still allowing today reward updates', async () => {
    const { service, updateSet } = createService({
      dateRewardRules: [
        {
          rewardDate: '2026-04-22',
          rewardItems: [{ assetType: 1, assetKey: '', amount: 8 }],
        },
        {
          rewardDate: '2026-04-23',
          rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
        },
        {
          rewardDate: '2026-04-24',
          rewardItems: [{ assetType: 1, assetKey: '', amount: 20 }],
        },
      ],
    })

    await expect(
      service.updateConfig(
        {
          isEnabled: true,
          makeupPeriodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
          periodicAllowance: 2,
          baseRewardItems: [{ assetType: 1, assetKey: '', amount: 1 }],
          dateRewardRules: [
            {
              rewardDate: '2026-04-23',
              rewardItems: [{ assetType: 1, assetKey: '', amount: 99 }],
            },
            {
              rewardDate: '2026-04-24',
              rewardItems: [{ assetType: 1, assetKey: '', amount: 30 }],
            },
            {
              rewardDate: '2026-04-25',
              rewardItems: [{ assetType: 2, assetKey: '', amount: 40 }],
            },
          ],
          patternRewardRules: [],
        } as never,
        99,
      ),
    ).resolves.toBe(true)

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        dateRewardRules: expect.arrayContaining([
          {
            rewardDate: '2026-04-22',
            rewardItems: [{ assetType: 1, assetKey: '', amount: 8 }],
          },
          {
            rewardDate: '2026-04-23',
            rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
          },
          {
            rewardDate: '2026-04-24',
            rewardItems: [{ assetType: 1, assetKey: '', amount: 30 }],
          },
          {
            rewardDate: '2026-04-25',
            rewardItems: [{ assetType: 2, assetKey: '', amount: 40 }],
          },
        ]),
      }),
    )
  })

  it('drops past date rewards when creating the first config', async () => {
    const { service, insertValues } = createService(null)

    await expect(
      service.updateConfig(
        {
          isEnabled: true,
          makeupPeriodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
          periodicAllowance: 2,
          baseRewardItems: [{ assetType: 1, assetKey: '', amount: 1 }],
          dateRewardRules: [
            {
              rewardDate: '2026-04-23',
              rewardItems: [{ assetType: 1, assetKey: '', amount: 99 }],
            },
            {
              rewardDate: '2026-04-24',
              rewardItems: [{ assetType: 1, assetKey: '', amount: 30 }],
            },
            {
              rewardDate: '2026-04-25',
              rewardItems: [{ assetType: 2, assetKey: '', amount: 40 }],
            },
          ],
          patternRewardRules: [],
        } as never,
        99,
      ),
    ).resolves.toBe(true)

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        dateRewardRules: [
          {
            rewardDate: '2026-04-24',
            rewardItems: [{ assetType: 1, assetKey: '', amount: 30 }],
          },
          {
            rewardDate: '2026-04-25',
            rewardItems: [{ assetType: 2, assetKey: '', amount: 40 }],
          },
        ],
      }),
    )
  })

  it('locks past monthly reward days by materializing them into date rules', async () => {
    jest.setSystemTime(new Date('2026-04-26T04:00:00.000Z'))
    const { service, updateSet } = createService({
      makeupPeriodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
      dateRewardRules: [],
      patternRewardRules: [
        {
          patternType: 2,
          weekday: null,
          monthDay: 24,
          rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
        },
      ],
    })

    await expect(
      service.updateConfig(
        {
          isEnabled: true,
          makeupPeriodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
          periodicAllowance: 2,
          baseRewardItems: null,
          dateRewardRules: [],
          patternRewardRules: [
            {
              patternType: 2,
              weekday: null,
              monthDay: 24,
              rewardItems: [{ assetType: 1, assetKey: '', amount: 99 }],
            },
          ],
        } as never,
        99,
      ),
    ).resolves.toBe(true)

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        dateRewardRules: expect.arrayContaining([
          {
            rewardDate: '2026-04-24',
            rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
          },
          {
            rewardDate: '2026-04-25',
            rewardItems: null,
          },
        ]),
      }),
    )
  })

  function createMutationHarness(options?: {
    currentRule?: {
      id: number
      ruleCode: string
      streakDays: number
      version: number
      status: CheckInStreakConfigStatusEnum
      publishStrategy: CheckInStreakPublishStrategyEnum
      effectiveFrom: Date
      effectiveTo: Date | null
      repeatable: boolean
      updatedById: number | null
      createdAt: Date
      updatedAt: Date
    } | null
  }) {
    const ruleUpdates: Array<Record<string, unknown>> = []
    const insertedRuleValues: Array<Record<string, unknown>> = []
    const insertedRewardItems: Array<Record<string, unknown>[]> = []
    const tx = {
      execute: jest.fn().mockResolvedValue(undefined),
      query: {
        checkInStreakRule: {
          findFirst: jest.fn().mockResolvedValue(options?.currentRule ?? null),
        },
      },
      update: jest.fn((table: unknown) => ({
        set: jest.fn((payload: Record<string, unknown>) => {
          if (table === checkInStreakRule) {
            ruleUpdates.push(payload)
          }
          return {
            where: jest.fn().mockResolvedValue(undefined),
          }
        }),
      })),
      insert: jest.fn((table: unknown) => ({
        values: jest.fn((payload: Record<string, unknown> | Record<string, unknown>[]) => {
          if (table === checkInStreakRule) {
            insertedRuleValues.push(payload as Record<string, unknown>)
            return {
              returning: jest.fn().mockResolvedValue([{ id: 66 }]),
            }
          }

          insertedRewardItems.push(payload as Record<string, unknown>[])
          return Promise.resolve(undefined)
        }),
      })),
    }
    const drizzle = {
      schema: {
        checkInConfig,
        checkInStreakRule,
        checkInStreakRuleRewardItem,
      },
      withTransaction: jest.fn(async (callback: (db: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    }
    const rewardPolicyService = new CheckInRewardPolicyService(
      {} as never,
      {} as never,
    )
    const makeupService = new CheckInMakeupService({} as never, {} as never)
    const streakService = new CheckInStreakService({} as never, {} as never)
    const service = new CheckInDefinitionService(
      drizzle as never,
      {} as never,
      makeupService,
      rewardPolicyService,
      streakService,
    )

    return {
      service,
      streakService,
      ruleUpdates,
      insertedRuleValues,
      insertedRewardItems,
    }
  }

  it('bridges the previous streak version window when publishing a new version', async () => {
    const harness = createMutationHarness()
    jest
      .spyOn(harness.streakService, 'findLatestStreakRuleVersion')
      .mockResolvedValue({
        id: 40,
        ruleCode: 'streak-day-7',
        streakDays: 7,
        version: 3,
        status: CheckInStreakConfigStatusEnum.ACTIVE,
        publishStrategy: CheckInStreakPublishStrategyEnum.IMMEDIATE,
        effectiveFrom: new Date('2026-04-20T00:00:00.000Z'),
        effectiveTo: null,
        repeatable: false,
        updatedById: 1,
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
        updatedAt: new Date('2026-04-20T00:00:00.000Z'),
      } as never)
    jest
      .spyOn(harness.streakService, 'listStreakRuleVersionsByCode')
      .mockResolvedValue([
        {
          id: 40,
          ruleCode: 'streak-day-7',
          streakDays: 7,
          version: 3,
          status: CheckInStreakConfigStatusEnum.ACTIVE,
          publishStrategy: CheckInStreakPublishStrategyEnum.IMMEDIATE,
          effectiveFrom: new Date('2026-04-20T00:00:00.000Z'),
          effectiveTo: null,
          repeatable: false,
          updatedById: 1,
          createdAt: new Date('2026-04-20T00:00:00.000Z'),
          updatedAt: new Date('2026-04-20T00:00:00.000Z'),
        },
      ] as never)

    await expect(
      harness.service.publishStreakRule(
        {
          streakDays: 7,
          repeatable: false,
          rewardItems: [{ assetType: 1, assetKey: '', amount: 20 }],
          publishStrategy: CheckInStreakPublishStrategyEnum.NEXT_DAY,
        } as never,
        88,
      ),
    ).resolves.toBe(true)

    expect(harness.insertedRuleValues[0]).toMatchObject({
      updatedById: 88,
      version: 4,
      ruleCode: 'streak-day-7',
    })
    expect(harness.insertedRuleValues[0].effectiveFrom).toEqual(
      startOfNextDayInAppTimeZone(new Date('2026-04-24T04:00:00.000Z')),
    )
    expect(harness.ruleUpdates[0]).toMatchObject({
      effectiveTo: harness.insertedRuleValues[0].effectiveFrom,
      updatedById: 88,
    })
    expect(harness.insertedRewardItems[0]).toEqual([
      {
        amount: 20,
        assetKey: '',
        assetType: 1,
        ruleId: 66,
        sortOrder: 0,
      },
    ])
  })

  it('bridges the predecessor window when terminating a scheduled streak version', async () => {
    const currentRule = {
      id: 52,
      ruleCode: 'streak-day-7',
      streakDays: 7,
      version: 5,
      status: CheckInStreakConfigStatusEnum.SCHEDULED,
      publishStrategy: CheckInStreakPublishStrategyEnum.NEXT_DAY,
      effectiveFrom: new Date('2026-04-26T00:00:00.000Z'),
      effectiveTo: null,
      repeatable: false,
      updatedById: 1,
      createdAt: new Date('2026-04-24T00:00:00.000Z'),
      updatedAt: new Date('2026-04-24T00:00:00.000Z'),
    }
    const harness = createMutationHarness({
      currentRule,
    })
    jest
      .spyOn(harness.streakService, 'listStreakRuleVersionsByCode')
      .mockResolvedValue([
        {
          id: 40,
          ruleCode: 'streak-day-7',
          streakDays: 7,
          version: 4,
          status: CheckInStreakConfigStatusEnum.ACTIVE,
          publishStrategy: CheckInStreakPublishStrategyEnum.IMMEDIATE,
          effectiveFrom: new Date('2026-04-20T00:00:00.000Z'),
          effectiveTo: new Date('2026-04-26T00:00:00.000Z'),
          repeatable: false,
          updatedById: 1,
          createdAt: new Date('2026-04-20T00:00:00.000Z'),
          updatedAt: new Date('2026-04-20T00:00:00.000Z'),
        },
        currentRule,
        {
          id: 60,
          ruleCode: 'streak-day-7',
          streakDays: 7,
          version: 6,
          status: CheckInStreakConfigStatusEnum.SCHEDULED,
          publishStrategy: CheckInStreakPublishStrategyEnum.SCHEDULED_AT,
          effectiveFrom: new Date('2026-04-30T00:00:00.000Z'),
          effectiveTo: null,
          repeatable: false,
          updatedById: 1,
          createdAt: new Date('2026-04-24T00:00:00.000Z'),
          updatedAt: new Date('2026-04-24T00:00:00.000Z'),
        },
      ] as never)

    await expect(
      harness.service.terminateStreakRule({ id: 52 }, 99),
    ).resolves.toBe(true)

    expect(harness.ruleUpdates[0]).toMatchObject({
      status: CheckInStreakConfigStatusEnum.TERMINATED,
      updatedById: 99,
    })
    expect(harness.ruleUpdates[1]).toMatchObject({
      effectiveTo: new Date('2026-04-30T00:00:00.000Z'),
      updatedById: 99,
    })
  })
})
