import {
  addDaysToDateOnlyInAppTimeZone,
  diffDateOnlyInAppTimeZone,
  endOfDayInAppTimeZone,
  getDateOnlyPartsInAppTimeZone,
  parseDateOnlyInAppTimeZone,
  startOfNextDayInAppTimeZone,
} from './time'

describe('time utils', () => {
  const originalTimeZone = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'Asia/Shanghai'
  })

  afterAll(() => {
    if (originalTimeZone === undefined) {
      delete process.env.TZ
      return
    }

    process.env.TZ = originalTimeZone
  })

  it('parses date-only boundaries using the app natural day', () => {
    const startOfDay = parseDateOnlyInAppTimeZone('2026-04-20')

    expect(startOfDay?.toISOString()).toBe('2026-04-19T16:00:00.000Z')
    expect(endOfDayInAppTimeZone(startOfDay!).toISOString()).toBe(
      '2026-04-20T15:59:59.999Z',
    )
  })

  it('shifts and compares date-only strings across month boundaries', () => {
    expect(addDaysToDateOnlyInAppTimeZone('2026-02-28', 2)).toBe('2026-03-02')
    expect(diffDateOnlyInAppTimeZone('2026-03-02', '2026-02-28')).toBe(2)
    expect(getDateOnlyPartsInAppTimeZone('2026-04-26')).toMatchObject({
      weekday: 7,
      monthStartDate: '2026-04-01',
      monthEndDate: '2026-04-30',
    })
  })

  it('resolves next-day start from an arbitrary app local timestamp', () => {
    expect(
      startOfNextDayInAppTimeZone('2026-04-20T10:30:00+08:00').toISOString(),
    ).toBe('2026-04-20T16:00:00.000Z')
  })
})
