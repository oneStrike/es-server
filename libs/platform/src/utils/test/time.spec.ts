import {
  buildDateOnlyRangeInAppTimeZone,
  formatDateKeyInAppTimeZone,
  formatDateOnlyInAppTimeZone,
  formatDateTimeInAppTimeZone,
  parseDateOnlyInAppTimeZone,
  startOfDayInAppTimeZone,
} from '../time'

describe('time utils', () => {
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

  it('parses date-only ranges using Asia/Shanghai natural days', () => {
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      '2026-03-10',
      '2026-03-10',
    )

    expect(dateRange?.gte?.toISOString()).toBe('2026-03-09T16:00:00.000Z')
    expect(dateRange?.lt?.toISOString()).toBe('2026-03-10T16:00:00.000Z')
  })

  it('rejects invalid date-only input instead of rolling to another day', () => {
    expect(parseDateOnlyInAppTimeZone('2026-02-31')).toBeUndefined()
    expect(buildDateOnlyRangeInAppTimeZone('2026-02-31')).toBeUndefined()
  })

  it('formats time values using Asia/Shanghai wall clock time', () => {
    const input = new Date('2026-03-10T16:03:22.317Z')

    expect(formatDateOnlyInAppTimeZone(input)).toBe('2026-03-11')
    expect(formatDateKeyInAppTimeZone(input)).toBe('2026-03-11')
    expect(formatDateTimeInAppTimeZone(input)).toBe('2026-03-11 00:03:22')
  })

  it('returns the start of the Asia/Shanghai natural day for a timestamp', () => {
    const input = new Date('2026-03-10T16:03:22.317Z')

    expect(startOfDayInAppTimeZone(input).toISOString()).toBe(
      '2026-03-10T16:00:00.000Z',
    )
  })
})
