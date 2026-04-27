import { checkInStreakProgress } from '@db/schema'
import { CheckInStreakConfigStatusEnum } from './check-in.constant'
import { CheckInStreakService } from './check-in-streak.service'

describe('check-in streak service', () => {
  function createService() {
    return new CheckInStreakService(
      {
        schema: {
          checkInStreakProgress,
        },
      } as never,
      {} as never,
    )
  }

  it('resets effective streak to zero when last signed date is stale', () => {
    const service = createService()

    expect(
      service.resolveEffectiveCurrentStreak(3, '2026-04-18', '2026-04-22'),
    ).toBe(0)
  })

  it('keeps latest signed date when it is still in the active streak window', () => {
    const service = createService()

    expect(
      service.resolveEffectiveLastSignedDate('2026-04-21', '2026-04-22'),
    ).toBe('2026-04-21')
  })

  it('builds active streak progress condition without throwing on valid dates', () => {
    const service = createService()

    expect(() => service.buildActiveStreakProgressWhere('2026-04-22')).not.toThrow()
  })

  it('resolves status by time window and terminal states', () => {
    const service = createService()
    const now = new Date('2026-04-22T10:00:00.000Z')

    expect(
      service.resolveStreakRuleStatus(
        {
          status: CheckInStreakConfigStatusEnum.TERMINATED,
          effectiveFrom: new Date('2026-04-20T00:00:00.000Z'),
          effectiveTo: null,
        },
        now,
      ),
    ).toBe(CheckInStreakConfigStatusEnum.TERMINATED)

    expect(
      service.resolveStreakRuleStatus(
        {
          status: CheckInStreakConfigStatusEnum.ACTIVE,
          effectiveFrom: new Date('2026-04-23T00:00:00.000Z'),
          effectiveTo: null,
        },
        now,
      ),
    ).toBe(CheckInStreakConfigStatusEnum.SCHEDULED)
  })

  it('keeps streak rule overview icon when mapping runtime rule views', () => {
    const service = createService()

    expect(
      service.toStreakRewardRuleViews([
        {
          ruleCode: 'streak-day-7',
          streakDays: 7,
          repeatable: false,
          status: CheckInStreakConfigStatusEnum.ACTIVE,
          effectiveFrom: new Date('2026-04-20T00:00:00.000Z'),
          effectiveTo: null,
          rewardOverviewIconUrl:
            'https://cdn.example.com/streak-overview.png',
          rewardItems: [
            {
              assetType: 1,
              assetKey: '',
              amount: 20,
              iconUrl: 'https://cdn.example.com/streak-item.png',
            },
          ],
        },
      ] as never),
    ).toEqual([
      expect.objectContaining({
        ruleCode: 'streak-day-7',
        rewardOverviewIconUrl:
          'https://cdn.example.com/streak-overview.png',
      }),
    ])
  })
})
