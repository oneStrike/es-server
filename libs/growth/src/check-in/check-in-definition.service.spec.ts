/// <reference types="jest" />
import type { DrizzleService } from '@db/core'
import { PgDialect } from 'drizzle-orm/pg-core/dialect'
import { CheckInDefinitionService } from './check-in-definition.service'
import {
  CheckInStreakConfigStatusEnum,
  CheckInStreakPublishStrategyEnum,
} from './check-in.constant'

const dialect = new PgDialect()

function compileSql(query: unknown) {
  return dialect.sqlToQuery(query as never).sql
}

function buildPageRow(overrides?: Partial<{
  createdAt: Date
  effectiveFrom: Date
  effectiveTo: Date | null
  id: number
  publishStrategy: number
  repeatable: boolean
  ruleCode: string
  status: number
  streakDays: number
  updatedAt: Date
  updatedById: number | null
  version: number
}>) {
  return {
    createdAt: new Date('2026-04-20T00:00:00.000Z'),
    effectiveFrom: new Date('2026-04-20T00:00:00.000Z'),
    effectiveTo: null,
    id: 11,
    publishStrategy: CheckInStreakPublishStrategyEnum.IMMEDIATE,
    repeatable: false,
    ruleCode: 'streak-day-3',
    status: CheckInStreakConfigStatusEnum.ACTIVE,
    streakDays: 3,
    updatedAt: new Date('2026-04-20T00:00:00.000Z'),
    updatedById: 9,
    version: 1,
    ...overrides,
  }
}

function createDefinitionHarness(options?: {
  allRules?: Array<{
    effectiveFrom: Date
    effectiveTo: Date | null
    id: number
    ruleCode: string
    status: number
    streakDays: number
    version: number
  }>
  pageRows?: Array<ReturnType<typeof buildPageRow>>
  currentRule?: {
    effectiveFrom: Date
    effectiveTo: Date | null
    id: number
    ruleCode: string
    status: number
    streakDays: number
    version: number
  } | null
}) {
  const insertCalls: Array<{ table: string; payload: unknown }> = []
  const updatePayloads: Array<Record<string, unknown>> = []

  const schema = {
    checkInConfig: {},
    checkInMakeupFact: {},
    checkInMakeupAccount: {},
    checkInRecord: {},
    checkInStreakRule: { __table: 'streakRule', id: 'id' },
    checkInStreakRuleRewardItem: { __table: 'streakRuleRewardItem', id: 'id' },
    checkInStreakProgress: {},
    checkInStreakGrant: {},
    checkInStreakGrantRewardItem: {},
    growthRewardSettlement: {},
  }

  let insertedRuleId = 300

  const tx = {
    execute: jest.fn().mockResolvedValue({
      rows: options?.pageRows ?? [],
    }),
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        orderBy: jest.fn().mockResolvedValue(options?.allRules ?? []),
      }),
    }),
    insert: jest.fn((table: { __table?: string }) => ({
      values: jest.fn((payload: unknown) => {
        insertCalls.push({ table: table.__table ?? 'unknown', payload })
        if (table.__table === 'streakRule') {
          return {
            returning: jest
              .fn()
              .mockResolvedValue([{ id: insertedRuleId++, streakDays: 3 }]),
          }
        }
        return {
          returning: jest.fn().mockResolvedValue([]),
        }
      }),
    })),
    update: jest.fn().mockImplementation(() => {
      const chain = {
        set: jest.fn((payload: Record<string, unknown>) => {
          updatePayloads.push(payload)
          return chain
        }),
        where: jest.fn().mockResolvedValue({ rowCount: 1 }),
      }
      return chain
    }),
    query: {
      checkInStreakRule: {
        findFirst: jest.fn().mockResolvedValue(options?.currentRule ?? null),
      },
    },
  }

  const drizzle = {
    withTransaction: async <T>(callback: (runner: typeof tx) => Promise<T>) =>
      callback(tx),
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
    db: tx,
    schema,
    ext: {
      findPagination: jest.fn().mockResolvedValue({
        list: [],
        total: 0,
        pageIndex: 1,
        pageSize: 20,
      }),
    },
  } as unknown as DrizzleService

  return {
    drizzle,
    insertCalls,
    updatePayloads,
  }
}

describe('checkInDefinitionService per-rule streak lifecycle', () => {
  it('publishes a single streak-day record version plus reward-item rows', async () => {
    const harness = createDefinitionHarness()
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)
    jest.spyOn(service as any, 'findLatestStreakRuleVersion').mockResolvedValue({
      id: 11,
      ruleCode: 'streak-day-3',
      streakDays: 3,
      version: 2,
    })
    jest.spyOn(service as any, 'listStreakRuleVersionsByCode').mockResolvedValue([])

    await (service as any).publishStreakRule(
      {
        publishStrategy: CheckInStreakPublishStrategyEnum.NEXT_DAY,
        repeatable: false,
        rewardItems: [
          { assetType: 1, assetKey: '', amount: 10 },
          { assetType: 2, assetKey: '', amount: 5 },
        ],
        streakDays: 3,
      },
      9,
    )

    expect(harness.insertCalls.map((item) => item.table)).toEqual([
      'streakRule',
      'streakRuleRewardItem',
    ])

    const ruleInsert = harness.insertCalls.find(
      (item) => item.table === 'streakRule',
    )?.payload as Record<string, unknown>
    expect(ruleInsert).toMatchObject({
      publishStrategy: CheckInStreakPublishStrategyEnum.NEXT_DAY,
      repeatable: false,
      ruleCode: 'streak-day-3',
      streakDays: 3,
      updatedById: 9,
      version: 3,
    })

    const rewardItemInsert = harness.insertCalls.find(
      (item) => item.table === 'streakRuleRewardItem',
    )?.payload as Array<Record<string, unknown>>
    expect(rewardItemInsert).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: 10,
          assetType: 1,
          ruleId: 300,
        }),
        expect.objectContaining({
          amount: 5,
          assetType: 2,
          ruleId: 300,
        }),
      ]),
    )
    expect((harness.drizzle.db.execute as jest.Mock).mock.calls).toHaveLength(1)
  })

  it('publishing a new version only cuts over records in the same streak-day family', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-20T00:00:00.000Z'))

    const harness = createDefinitionHarness()
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)
    jest.spyOn(service as any, 'findLatestStreakRuleVersion').mockResolvedValue({
      id: 12,
      ruleCode: 'streak-day-3',
      streakDays: 3,
      version: 3,
    })
    jest.spyOn(service as any, 'listStreakRuleVersionsByCode').mockResolvedValue([
      {
        id: 12,
        effectiveFrom: new Date('2026-04-22T00:00:00.000Z'),
        effectiveTo: null,
        ruleCode: 'streak-day-3',
        status: CheckInStreakConfigStatusEnum.SCHEDULED,
        streakDays: 3,
        version: 3,
      },
      {
        id: 11,
        effectiveFrom: new Date('2026-04-19T00:00:00.000Z'),
        effectiveTo: null,
        ruleCode: 'streak-day-3',
        status: CheckInStreakConfigStatusEnum.ACTIVE,
        streakDays: 3,
        version: 2,
      },
    ])

    await (service as any).publishStreakRule(
      {
        effectiveFrom: '2026-04-21T00:00:00.000Z',
        publishStrategy: CheckInStreakPublishStrategyEnum.SCHEDULED_AT,
        repeatable: false,
        rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
        streakDays: 3,
      },
      9,
    )

    expect(harness.updatePayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effectiveTo: new Date('2026-04-21T00:00:00.000Z'),
          status: CheckInStreakConfigStatusEnum.ACTIVE,
          updatedById: 9,
        }),
        expect.objectContaining({
          status: CheckInStreakConfigStatusEnum.TERMINATED,
          updatedById: 9,
        }),
      ]),
    )

    jest.useRealTimers()
  })

  it('allows terminating one scheduled record version without requiring a predecessor', async () => {
    const harness = createDefinitionHarness({
      currentRule: {
        effectiveFrom: new Date('2026-04-22T00:00:00.000Z'),
        effectiveTo: null,
        id: 12,
        ruleCode: 'streak-day-3',
        status: CheckInStreakConfigStatusEnum.SCHEDULED,
        streakDays: 3,
        version: 2,
      },
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)
    jest.spyOn(service as any, 'listStreakRuleVersionsByCode').mockResolvedValue([
      {
        effectiveFrom: new Date('2026-04-22T00:00:00.000Z'),
        effectiveTo: null,
        id: 12,
        ruleCode: 'streak-day-3',
        status: CheckInStreakConfigStatusEnum.SCHEDULED,
        streakDays: 3,
        version: 2,
      },
    ])

    await (service as any).terminateStreakRule({ id: 12 }, 9)

    expect(harness.updatePayloads).toEqual([
      expect.objectContaining({
        status: CheckInStreakConfigStatusEnum.TERMINATED,
        updatedById: 9,
      }),
    ])
  })

  it('terminating an active record version does not rewrite the predecessor window', async () => {
    const harness = createDefinitionHarness({
      currentRule: {
        effectiveFrom: new Date('2026-04-20T00:00:00.000Z'),
        effectiveTo: null,
        id: 12,
        ruleCode: 'streak-day-3',
        status: CheckInStreakConfigStatusEnum.ACTIVE,
        streakDays: 3,
        version: 2,
      },
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)
    jest.spyOn(service as any, 'listStreakRuleVersionsByCode').mockResolvedValue([
      {
        effectiveFrom: new Date('2026-04-20T00:00:00.000Z'),
        effectiveTo: null,
        id: 12,
        ruleCode: 'streak-day-3',
        status: CheckInStreakConfigStatusEnum.ACTIVE,
        streakDays: 3,
        version: 2,
      },
      {
        effectiveFrom: new Date('2026-04-10T00:00:00.000Z'),
        effectiveTo: new Date('2026-04-20T00:00:00.000Z'),
        id: 11,
        ruleCode: 'streak-day-3',
        status: CheckInStreakConfigStatusEnum.EXPIRED,
        streakDays: 3,
        version: 1,
      },
    ])

    await (service as any).terminateStreakRule({ id: 12 }, 9)

    expect(harness.updatePayloads).toEqual([
      expect.objectContaining({
        effectiveTo: expect.any(Date),
        status: CheckInStreakConfigStatusEnum.TERMINATED,
        updatedById: 9,
      }),
    ])
  })

  it('uses nearest effectiveFrom when filtering scheduled records on the main page', async () => {
    const harness = createDefinitionHarness({ pageRows: [] })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)

    await service.getStreakRulePage({
      pageIndex: 1,
      pageSize: 20,
      status: CheckInStreakConfigStatusEnum.SCHEDULED,
    })

    const sqlText = compileSql(
      (harness.drizzle.db.execute as jest.Mock).mock.calls[0][0],
    )

    expect(sqlText).toMatch(
      /PARTITION BY rule_code[\s\S]*ORDER BY effective_from ASC,\s*version DESC,\s*id ASC/i,
    )
  })

  it('applies explicit orderBy to the selected main page rows', async () => {
    const harness = createDefinitionHarness({
      pageRows: [
        buildPageRow(),
        buildPageRow({
          id: 21,
          ruleCode: 'streak-day-7',
          streakDays: 7,
        }),
      ],
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)
    jest
      .spyOn(service as any, 'buildStreakRuleDetailViews')
      .mockImplementation(async (...args: unknown[]) => {
        const [rules] = args as [Array<{ id: number; streakDays: number }>]
        return rules.map((rule) => ({
          id: rule.id,
          streakDays: rule.streakDays,
        }))
      })

    const page = await service.getStreakRulePage({
      orderBy: JSON.stringify([{ streakDays: 'desc' }]),
      pageIndex: 1,
      pageSize: 20,
    })

    expect(page.list).toEqual([
      { id: 21, streakDays: 7 },
      { id: 11, streakDays: 3 },
    ])
  })

  it('loads reward items for the main page with a single batch query', async () => {
    const harness = createDefinitionHarness({
      pageRows: [
        buildPageRow(),
        buildPageRow({
          id: 21,
          ruleCode: 'streak-day-7',
          streakDays: 7,
          version: 2,
        }),
      ],
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)
    const loadSpy = jest
      .spyOn(service as any, 'loadStreakRewardRuleRowsByIds')
      .mockResolvedValue([
        {
          ...buildPageRow(),
          rewardItems: [{ amount: 10, assetKey: '', assetType: 1 }],
        },
        {
          ...buildPageRow({
            id: 21,
            ruleCode: 'streak-day-7',
            streakDays: 7,
            version: 2,
          }),
          rewardItems: [{ amount: 20, assetKey: '', assetType: 1 }],
        },
      ])

    const page = await service.getStreakRulePage({
      pageIndex: 1,
      pageSize: 20,
    })

    expect(loadSpy).toHaveBeenCalledTimes(1)
    expect(loadSpy).toHaveBeenCalledWith([11, 21])
    expect(page.list).toHaveLength(2)
  })

  it('rejects scheduled publish times that are not later than now', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-20T00:00:00.000Z'))

    const harness = createDefinitionHarness()
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)

    await expect(
      (service as any).publishStreakRule(
        {
          effectiveFrom: '2026-04-20T00:00:00.000Z',
          publishStrategy: CheckInStreakPublishStrategyEnum.SCHEDULED_AT,
          repeatable: false,
          rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
          streakDays: 3,
        },
        9,
      ),
    ).rejects.toThrow('指定生效时间必须晚于当前时间')

    jest.useRealTimers()
  })
})
