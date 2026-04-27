import { CheckInRuntimeService } from './check-in-runtime.service'

describe('check-in runtime service orchestration', () => {
  function createService() {
    const rewardPolicyService = {
      resolveNextStreakReward: jest
        .fn()
        .mockReturnValue({ ruleCode: 'streak-day-5', streakDays: 5 }),
    }
    const makeupService = {
      buildCurrentMakeupAccountView: jest.fn().mockResolvedValue({
        periodType: 1,
        periodKey: 'week-2026-04-20',
        periodStartDate: '2026-04-20',
        periodEndDate: '2026-04-26',
        periodicGranted: 2,
        periodicUsed: 1,
        periodicRemaining: 1,
        eventAvailable: 0,
      }),
    }
    const streakService = {
      listActiveStreakRulesAt: jest.fn().mockResolvedValue([]),
      toStreakRewardRuleViews: jest.fn().mockReturnValue([]),
      resolveEffectiveCurrentStreak: jest.fn().mockReturnValue(3),
      resolveEffectiveLastSignedDate: jest.fn().mockReturnValue('2026-04-21'),
    }
    const settlementService = {
      buildGrantRewardItemMap: jest.fn().mockResolvedValue(new Map()),
      buildSettlementMapById: jest.fn().mockResolvedValue(new Map()),
      toRewardSettlementSummary: jest.fn().mockImplementation((value) => value),
    }
    const calendarReadModelService = {
      getCurrentUserCalendarByTargetDate: jest.fn().mockResolvedValue({
        periodType: 1,
        periodKey: 'week-2026-04-21',
        periodStartDate: '2026-04-21',
        periodEndDate: '2026-04-27',
        days: [],
      }),
    }
    const drizzle = {
      db: {
        query: {
          checkInStreakProgress: {
            findFirst: jest.fn().mockResolvedValue({
              currentStreak: 3,
              streakStartedAt: '2026-04-19',
              lastSignedDate: '2026-04-21',
            }),
          },
        },
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      },
      schema: {
        checkInStreakGrant: {
          userId: 'userId',
          triggerSignDate: 'triggerSignDate',
          id: 'id',
        },
      },
    }

    const service = new CheckInRuntimeService(
      drizzle as never,
      {} as never,
      rewardPolicyService as never,
      makeupService as never,
      streakService as never,
      settlementService as never,
      calendarReadModelService as never,
    )

    ;(
      service as unknown as {
        getRequiredConfig: () => Promise<unknown>
        getLatestRecord: (userId: number) => Promise<unknown>
        hasRecordForDate: (userId: number, signDate: string) => Promise<boolean>
        toConfigDetailView: (config: unknown) => unknown
      }
    ).getRequiredConfig = jest.fn().mockResolvedValue({
      id: 1,
      isEnabled: 1,
      makeupPeriodType: 1,
      periodicAllowance: 2,
    })
    ;(
      service as unknown as {
        getLatestRecord: (userId: number) => Promise<unknown>
      }
    ).getLatestRecord = jest.fn().mockResolvedValue(null)
    ;(
      service as unknown as {
        hasRecordForDate: (userId: number, signDate: string) => Promise<boolean>
      }
    ).hasRecordForDate = jest.fn().mockResolvedValue(true)
    ;(
      service as unknown as {
        toConfigDetailView: (config: unknown) => unknown
      }
    ).toConfigDetailView = jest.fn().mockReturnValue({
      id: 1,
      isEnabled: true,
      makeupIconUrl: 'https://cdn.example.com/makeup.png',
      rewardOverviewIconUrl: 'https://cdn.example.com/reward-overview.png',
    })

    return {
      service,
      rewardPolicyService,
      makeupService,
      streakService,
      calendarReadModelService,
      settlementService,
      drizzle,
    }
  }

  it('builds summary from collaborator services without changing response shape', async () => {
    const { service, rewardPolicyService, makeupService, streakService } =
      createService()

    const summary = await service.getSummary(9)

    expect(summary).toMatchObject({
      config: {
        id: 1,
        isEnabled: true,
        makeupIconUrl: 'https://cdn.example.com/makeup.png',
        rewardOverviewIconUrl:
          'https://cdn.example.com/reward-overview.png',
      },
      makeup: {
        periodType: 1,
        periodKey: 'week-2026-04-20',
      },
      streak: {
        currentStreak: 3,
        lastSignedDate: '2026-04-21',
        nextReward: { ruleCode: 'streak-day-5', streakDays: 5 },
      },
      todaySigned: true,
      latestRecord: null,
    })

    expect(makeupService.buildCurrentMakeupAccountView).toHaveBeenCalled()
    expect(streakService.listActiveStreakRulesAt).toHaveBeenCalled()
    expect(rewardPolicyService.resolveNextStreakReward).toHaveBeenCalled()
  })

  it('returns streak detail with effective progress and active reward rules', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T10:00:00.000Z'))
    const { service, streakService } = createService()

    streakService.toStreakRewardRuleViews = jest.fn().mockReturnValue([
      {
        ruleCode: 'streak-day-3',
        streakDays: 3,
        rewardItems: [{ assetType: 1, assetKey: '', amount: 30 }],
        rewardOverviewIconUrl: 'https://cdn.example.com/streak-day-3.png',
        repeatable: false,
        status: 2,
      },
    ])

    await expect(
      (
        service as CheckInRuntimeService & {
          getStreakDetail: (userId: number) => Promise<unknown>
        }
      ).getStreakDetail(9),
    ).resolves.toMatchObject({
      progress: {
        currentStreak: 3,
        streakStartedAt: '2026-04-19',
        lastSignedDate: '2026-04-21',
      },
      rewardRules: [
        {
          ruleCode: 'streak-day-3',
          streakDays: 3,
        },
      ],
    })

    jest.useRealTimers()
  })

  it('delegates old current-period calendar to the target-date calendar read model with today', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T10:00:00.000Z'))
    const { service, calendarReadModelService } = createService()

    const calendar = await service.getCalendar(9)

    expect(
      calendarReadModelService.getCurrentUserCalendarByTargetDate,
    ).toHaveBeenCalledWith(9, '2026-04-24')
    expect(calendar).toMatchObject({
      periodType: 1,
      periodKey: 'week-2026-04-21',
    })

    jest.useRealTimers()
  })

  it('returns frozen streak overview icon from grant snapshots', async () => {
    const { service, settlementService, drizzle } = createService()

    drizzle.db.select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue([
            {
              id: 51,
              userId: 9,
              ruleId: 7,
              ruleCode: 'streak-day-7',
              streakDays: 7,
              rewardOverviewIconUrl:
                'https://cdn.example.com/streak-overview.png',
              repeatable: false,
              triggerSignDate: '2026-04-23',
              rewardSettlementId: null,
              createdAt: '2026-04-23T00:00:00.000Z',
              updatedAt: '2026-04-23T00:00:00.000Z',
            },
          ]),
        }),
      }),
    })
    settlementService.buildGrantRewardItemMap = jest
      .fn()
      .mockResolvedValue(
        new Map([
          [
            51,
            [
              {
                assetType: 1,
                assetKey: '',
                amount: 20,
                iconUrl: 'https://cdn.example.com/streak-item.png',
              },
            ],
          ],
        ]),
      )

    const grants = await (
      service as unknown as {
        listGrantsForRecord: (
          userId: number,
          signDate: string,
        ) => Promise<unknown[]>
      }
    ).listGrantsForRecord(9, '2026-04-23')

    expect(grants).toEqual([
      expect.objectContaining({
        id: 51,
        rewardOverviewIconUrl:
          'https://cdn.example.com/streak-overview.png',
      }),
    ])
  })
})
