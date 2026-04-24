import { checkInConfig } from '@db/schema'
import { CheckInMakeupPeriodTypeEnum } from './check-in.constant'
import { CheckInDefinitionService } from './check-in-definition.service'
import { CheckInRewardPolicyService } from './check-in-reward-policy.service'

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

    const service = new CheckInDefinitionService(
      drizzle as never,
      {} as never,
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
})
