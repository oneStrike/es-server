/// <reference types="jest" />
import type { DrizzleService } from '@db/core'
import { CheckInDefinitionService } from './check-in-definition.service'
import {
  CheckInStreakConfigStatusEnum,
  CheckInStreakPublishStrategyEnum,
} from './check-in.constant'

function createDefinitionHarness(options?: {
  latestConfig?: { id: number; version: number } | null
  currentConfig?: {
    id: number
    effectiveFrom: Date
    effectiveTo: Date | null
    status: number
  } | null
}) {
  const insertCalls: Array<{ table: string; payload: unknown }> = []
  const updatePayloads: Array<Record<string, unknown>> = []

  const schema = {
    checkInConfig: {},
    checkInMakeupFact: {},
    checkInMakeupAccount: {},
    checkInRecord: {},
    checkInStreakConfig: { __table: 'streakConfig', id: 'id' },
    checkInStreakRule: { __table: 'streakRule', id: 'id' },
    checkInStreakRuleRewardItem: { __table: 'streakRuleRewardItem', id: 'id' },
    checkInStreakProgress: {},
    checkInStreakGrant: {},
    checkInStreakGrantRewardItem: {},
    growthRewardSettlement: {},
  }

  let insertedRuleId = 300

  const tx = {
    execute: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn((table: { __table?: string }) => ({
      values: jest.fn((payload: unknown) => {
        insertCalls.push({ table: table.__table ?? 'unknown', payload })
        if (table.__table === 'streakConfig') {
          return {
            returning: jest.fn().mockResolvedValue([{ id: 101 }]),
          }
        }
        if (table.__table === 'streakRule') {
          const rows = Array.isArray(payload) ? payload : [payload]
          return {
            returning: jest
              .fn()
              .mockResolvedValue(rows.map(() => ({ id: insertedRuleId++ }))),
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
      checkInStreakConfig: {
        findFirst: jest.fn().mockResolvedValue(options?.currentConfig ?? null),
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

describe('checkInDefinitionService unified streak persistence', () => {
  it('publishes streak config via head + rule + reward-item tables', async () => {
    const harness = createDefinitionHarness({
      latestConfig: { id: 11, version: 2 },
      currentConfig: {
        id: 11,
        effectiveFrom: new Date('2026-04-19T00:00:00.000Z'),
        effectiveTo: null,
        status: CheckInStreakConfigStatusEnum.ACTIVE,
      },
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)
    jest.spyOn(service as any, 'findLatestStreakConfig').mockResolvedValue({
      id: 11,
      version: 2,
    })
    jest.spyOn(service as any, 'listStreakConfigs').mockResolvedValue([
      {
        id: 11,
        effectiveFrom: new Date('2026-04-19T00:00:00.000Z'),
        effectiveTo: null,
        status: CheckInStreakConfigStatusEnum.ACTIVE,
      },
    ])

    await service.publishStreakConfig(
      {
        publishStrategy: CheckInStreakPublishStrategyEnum.NEXT_DAY,
        rewardRules: [
          {
            ruleCode: 'day-3',
            streakDays: 3,
            repeatable: false,
            rewardItems: [
              { assetType: 1, assetKey: '', amount: 10 },
              { assetType: 2, assetKey: '', amount: 5 },
            ],
          },
          {
            ruleCode: 'day-7',
            streakDays: 7,
            repeatable: true,
            rewardItems: [{ assetType: 1, assetKey: '', amount: 20 }],
          },
        ],
      } as never,
      9,
    )

    expect(harness.insertCalls.map((item) => item.table)).toEqual([
      'streakConfig',
      'streakRule',
      'streakRuleRewardItem',
    ])

    const configInsert = harness.insertCalls.find(
      (item) => item.table === 'streakConfig',
    )?.payload as Record<string, unknown>
    expect(configInsert).toMatchObject({
      version: 3,
      publishStrategy: CheckInStreakPublishStrategyEnum.NEXT_DAY,
      updatedById: 9,
    })

    const ruleInsert = harness.insertCalls.find(
      (item) => item.table === 'streakRule',
    )?.payload as Array<Record<string, unknown>>
    expect(ruleInsert).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          configId: 101,
          ruleCode: 'day-3',
          streakDays: 3,
        }),
        expect.objectContaining({
          configId: 101,
          ruleCode: 'day-7',
          streakDays: 7,
        }),
      ]),
    )

    const rewardItemInsert = harness.insertCalls.find(
      (item) => item.table === 'streakRuleRewardItem',
    )?.payload as Array<Record<string, unknown>>
    expect(rewardItemInsert).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 300,
          assetType: 1,
          amount: 10,
        }),
        expect.objectContaining({
          ruleId: 300,
          assetType: 2,
          amount: 5,
        }),
        expect.objectContaining({
          ruleId: 301,
          assetType: 1,
          amount: 20,
        }),
      ]),
    )
    expect((harness.drizzle.db.execute as jest.Mock).mock.calls).toHaveLength(1)
  })

  it('terminates later scheduled configs when publishing an earlier config', async () => {
    const harness = createDefinitionHarness({
      latestConfig: { id: 12, version: 3 },
      currentConfig: {
        id: 11,
        effectiveFrom: new Date('2026-04-19T00:00:00.000Z'),
        effectiveTo: null,
        status: CheckInStreakConfigStatusEnum.ACTIVE,
      },
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)
    jest.spyOn(service as any, 'findLatestStreakConfig').mockResolvedValue({
      id: 12,
      version: 3,
    })
    jest.spyOn(service as any, 'listStreakConfigs').mockResolvedValue([
      {
        id: 12,
        effectiveFrom: new Date('2026-04-22T00:00:00.000Z'),
        effectiveTo: null,
        status: CheckInStreakConfigStatusEnum.SCHEDULED,
      },
      {
        id: 11,
        effectiveFrom: new Date('2026-04-19T00:00:00.000Z'),
        effectiveTo: null,
        status: CheckInStreakConfigStatusEnum.ACTIVE,
      },
    ])

    await service.publishStreakConfig(
      {
        publishStrategy: CheckInStreakPublishStrategyEnum.SCHEDULED_AT,
        effectiveFrom: '2026-04-21T00:00:00.000Z',
        rewardRules: [
          {
            ruleCode: 'day-3',
            streakDays: 3,
            repeatable: false,
            rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
          },
        ],
      } as never,
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
  })

  it('reopens predecessor window when terminating a scheduled config', async () => {
    const harness = createDefinitionHarness({
      currentConfig: {
        id: 12,
        effectiveFrom: new Date('2026-04-22T00:00:00.000Z'),
        effectiveTo: null,
        status: CheckInStreakConfigStatusEnum.SCHEDULED,
      },
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)
    jest.spyOn(service as any, 'listStreakConfigs').mockResolvedValue([
      {
        id: 13,
        effectiveFrom: new Date('2026-04-25T00:00:00.000Z'),
        effectiveTo: null,
        status: CheckInStreakConfigStatusEnum.SCHEDULED,
      },
      {
        id: 12,
        effectiveFrom: new Date('2026-04-22T00:00:00.000Z'),
        effectiveTo: null,
        status: CheckInStreakConfigStatusEnum.SCHEDULED,
      },
      {
        id: 11,
        effectiveFrom: new Date('2026-04-19T00:00:00.000Z'),
        effectiveTo: new Date('2026-04-22T00:00:00.000Z'),
        status: CheckInStreakConfigStatusEnum.ACTIVE,
      },
    ])

    await service.terminateStreakConfig({ id: 12 }, 9)

    expect(harness.updatePayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: CheckInStreakConfigStatusEnum.TERMINATED,
          updatedById: 9,
        }),
        expect.objectContaining({
          effectiveTo: new Date('2026-04-25T00:00:00.000Z'),
          status: CheckInStreakConfigStatusEnum.ACTIVE,
          updatedById: 9,
        }),
      ]),
    )
    expect((harness.drizzle.db.execute as jest.Mock).mock.calls).toHaveLength(1)
  })

  it('rejects scheduled publish times that are not later than now', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-20T00:00:00.000Z'))

    const harness = createDefinitionHarness()
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)

    await expect(
      service.publishStreakConfig(
        {
          publishStrategy: CheckInStreakPublishStrategyEnum.SCHEDULED_AT,
          effectiveFrom: '2026-04-20T00:00:00.000Z',
          rewardRules: [
            {
              ruleCode: 'day-3',
              streakDays: 3,
              repeatable: false,
              rewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
            },
          ],
        } as never,
        9,
      ),
    ).rejects.toThrow('指定生效时间必须晚于当前时间')

    jest.useRealTimers()
  })
})
