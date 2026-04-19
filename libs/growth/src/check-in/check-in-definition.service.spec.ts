import type { DrizzleService } from '@db/core'
import { BusinessException } from '@libs/platform/exceptions'
import { CheckInDefinitionService } from './check-in-definition.service'
import {
  CheckInStreakNextRoundStrategyEnum,
  CheckInStreakRoundStatusEnum,
} from './check-in.constant'

function createRoundMutationHarness(options?: {
  createdRound?: { id: number }
}) {
  const updatePayloads: Record<string, unknown>[] = []
  const insertPayloads: Record<string, unknown>[] = []
  const execute = jest.fn().mockResolvedValue(undefined)

  const tx = {
    execute,
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
    insert: jest.fn().mockImplementation(() => ({
      values: jest.fn((payload: Record<string, unknown>) => {
        insertPayloads.push(payload)
        return {
          returning: jest
            .fn()
            .mockResolvedValue([options?.createdRound ?? { id: 3 }]),
        }
      }),
    })),
  }

  const drizzle = {
    withTransaction: async <T>(callback: (runner: typeof tx) => Promise<T>) =>
      callback(tx),
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
    db: {
      query: {
        checkInStreakRoundConfig: {
          findFirst: jest.fn(),
        },
      },
    },
    schema: {
      checkInConfig: {},
      checkInMakeupFact: {},
      checkInMakeupAccount: {},
      checkInRecord: {},
      checkInStreakRoundConfig: {
        id: 'id',
        roundCode: 'roundCode',
        version: 'version',
      },
      checkInStreakProgress: {},
      checkInStreakRewardGrant: {},
      growthRewardSettlement: {},
    },
  } as unknown as DrizzleService

  return {
    drizzle,
    tx,
    updatePayloads,
    insertPayloads,
  }
}

describe('checkInDefinitionService', () => {
  it('rejects non-active round updates', async () => {
    const service = new CheckInDefinitionService(
      createRoundMutationHarness().drizzle,
      {} as never,
    )

    await expect(
      service.updateRound(
        {
          roundCode: 'draft-round',
          status: CheckInStreakRoundStatusEnum.DRAFT,
          nextRoundStrategy: CheckInStreakNextRoundStrategyEnum.INHERIT,
          rewardRules: [],
        },
        1,
      ),
    ).rejects.toThrow(BusinessException)
  })

  it('rejects explicit-next submissions on active round updates', async () => {
    const service = new CheckInDefinitionService(
      createRoundMutationHarness().drizzle,
      {} as never,
    )

    await expect(
      service.updateRound(
        {
          roundCode: 'active-round',
          status: CheckInStreakRoundStatusEnum.ACTIVE,
          nextRoundStrategy: CheckInStreakNextRoundStrategyEnum.EXPLICIT_NEXT,
          nextRoundConfigId: 2,
          rewardRules: [],
        },
        1,
      ),
    ).rejects.toThrow('当前启用接口不支持提交显式下一轮策略')
  })

  it('rejects inherit payloads that still carry nextRoundConfigId', async () => {
    const service = new CheckInDefinitionService(
      createRoundMutationHarness().drizzle,
      {} as never,
    )

    await expect(
      service.updateRound(
        {
          roundCode: 'active-round',
          status: CheckInStreakRoundStatusEnum.ACTIVE,
          nextRoundStrategy: CheckInStreakNextRoundStrategyEnum.INHERIT,
          nextRoundConfigId: 2,
          rewardRules: [],
        },
        1,
      ),
    ).rejects.toThrow('沿用当前轮策略不允许传入 nextRoundConfigId')
  })

  it('archives the previous active round and links it to the new successor', async () => {
    const harness = createRoundMutationHarness({
      createdRound: { id: 5 },
    })
    const service = new CheckInDefinitionService(harness.drizzle, {} as never)

    jest.spyOn(service as any, 'getActiveRound').mockResolvedValue({
      id: 2,
      roundCode: 'default-round',
      version: 2,
      status: CheckInStreakRoundStatusEnum.ACTIVE,
    })
    jest.spyOn(service as any, 'findLatestRoundByCode').mockResolvedValue({
      id: 4,
      roundCode: 'default-round',
      version: 2,
    })

    await service.updateRound(
      {
        roundCode: 'default-round',
        status: CheckInStreakRoundStatusEnum.ACTIVE,
        nextRoundStrategy: CheckInStreakNextRoundStrategyEnum.INHERIT,
        rewardRules: [],
      },
      9,
    )

    expect(harness.insertPayloads[0]).toMatchObject({
      roundCode: 'default-round',
      version: 3,
      status: CheckInStreakRoundStatusEnum.ACTIVE,
      nextRoundStrategy: CheckInStreakNextRoundStrategyEnum.INHERIT,
      nextRoundConfigId: null,
      updatedById: 9,
    })
    expect(harness.updatePayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: CheckInStreakRoundStatusEnum.ARCHIVED,
          updatedById: 9,
        }),
        expect.objectContaining({
          nextRoundStrategy: CheckInStreakNextRoundStrategyEnum.EXPLICIT_NEXT,
          nextRoundConfigId: 5,
          updatedById: 9,
        }),
      ]),
    )
    expect(harness.tx.execute).toHaveBeenCalled()
  })
})
