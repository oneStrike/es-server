import { CheckInStreakService } from './check-in-streak.service'

describe('CheckInStreakService bounded streak helpers', () => {
  it('builds incremental normal sign aggregation from progress only', () => {
    const service = createService()

    expect(
      service.buildIncrementalNormalSignAggregation(
        {
          id: 1,
          currentStreak: 4,
          streakStartedAt: '2026-05-27',
          lastSignedDate: '2026-05-30',
          version: 1,
        },
        '2026-05-31',
      ),
    ).toEqual({
      currentStreak: 5,
      streakStartedAt: '2026-05-27',
      lastSignedDate: '2026-05-31',
      streakByDate: { '2026-05-31': 5 },
    })
  })

  it('builds bounded makeup aggregation from the current makeup period range', async () => {
    const service = createService()
    const tx = createRangeTx([
      { signDate: '2026-05-18' },
      { signDate: '2026-05-20' },
      { signDate: '2026-05-21' },
      { signDate: '2026-05-22' },
      { signDate: '2026-05-30' },
      { signDate: '2026-05-31' },
    ])

    const result = await service.buildMakeupBoundedStreakAggregation(
      {
        userId: 9,
        makeupDate: '2026-05-21',
        periodStartDate: '2026-05-01',
        today: '2026-05-31',
        currentProgress: {
          id: 2,
          currentStreak: 2,
          streakStartedAt: '2026-05-30',
          lastSignedDate: '2026-05-31',
          version: 3,
        },
      },
      tx as never,
    )

    expect(result.affectedStart).toBe('2026-05-20')
    expect(result.affectedEnd).toBe('2026-05-22')
    expect(result.seedStreakBeforeStart).toBe(0)
    expect(result.records).toEqual([
      { signDate: '2026-05-20' },
      { signDate: '2026-05-21' },
      { signDate: '2026-05-22' },
    ])
    expect(result.aggregation).toEqual({
      currentStreak: 3,
      streakStartedAt: '2026-05-20',
      lastSignedDate: '2026-05-22',
      streakByDate: {
        '2026-05-20': 1,
        '2026-05-21': 2,
        '2026-05-22': 3,
      },
    })
    expect(tx.select).toHaveBeenCalledTimes(1)
  })

  it('seeds first-day period makeup from the active cross-period streak chain', async () => {
    const service = createService()
    const tx = createRangeTx([
      { signDate: '2026-04-29' },
      { signDate: '2026-04-30' },
      { signDate: '2026-05-01' },
      { signDate: '2026-05-02' },
      { signDate: '2026-05-03' },
    ])

    const result = await service.buildMakeupBoundedStreakAggregation(
      {
        userId: 9,
        makeupDate: '2026-05-01',
        periodStartDate: '2026-05-01',
        today: '2026-05-03',
        currentProgress: {
          id: 2,
          currentStreak: 5,
          streakStartedAt: '2026-04-29',
          lastSignedDate: '2026-05-03',
          version: 3,
        },
      },
      tx as never,
    )

    expect(result.affectedStart).toBe('2026-05-01')
    expect(result.affectedEnd).toBe('2026-05-03')
    expect(result.seedStreakBeforeStart).toBe(2)
    expect(result.records).toEqual([
      { signDate: '2026-05-01' },
      { signDate: '2026-05-02' },
      { signDate: '2026-05-03' },
    ])
    expect(result.aggregation).toEqual({
      currentStreak: 5,
      streakStartedAt: '2026-04-29',
      lastSignedDate: '2026-05-03',
      streakByDate: {
        '2026-05-01': 3,
        '2026-05-02': 4,
        '2026-05-03': 5,
      },
    })
    expect(tx.select).toHaveBeenCalledTimes(1)
  })
})

function createService() {
  return new CheckInStreakService(
    {
      schema: {
        checkInRecord: {
          id: 'check_in_record.id',
          userId: 'check_in_record.user_id',
          signDate: 'check_in_record.sign_date',
        },
      },
    } as never,
    {} as never,
  )
}

function createRangeTx(records: Array<{ signDate: string }>) {
  const orderBy = jest.fn(() => Promise.resolve(records))
  const where = jest.fn(() => ({ orderBy }))
  const from = jest.fn(() => ({ where }))
  return {
    select: jest.fn(() => ({ from })),
  }
}
