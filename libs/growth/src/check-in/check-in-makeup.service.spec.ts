import { CheckInMakeupPeriodTypeEnum } from './check-in.constant'
import { CheckInMakeupService } from './check-in-makeup.service'

describe('check-in makeup service', () => {
  function createService() {
    return new CheckInMakeupService({} as never, {} as never)
  }

  it('builds weekly window from monday to sunday', () => {
    const service = createService()

    expect(
      service.buildMakeupWindow(
        '2026-04-22',
        CheckInMakeupPeriodTypeEnum.WEEKLY,
      ),
    ).toEqual({
      periodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
      periodKey: 'week-2026-04-20',
      periodStartDate: '2026-04-20',
      periodEndDate: '2026-04-26',
    })
  })

  it('prefers periodic allowance before event cards when building consume plan', () => {
    const service = createService()

    expect(
      service.buildMakeupConsumePlan({
        periodicGranted: 2,
        periodicUsed: 1,
        eventAvailable: 3,
      }),
    ).toEqual([
      {
        sourceType: 1,
        amount: 1,
      },
    ])
  })

  it('throws when no makeup quota is available', () => {
    const service = createService()

    expect(() =>
      service.buildMakeupConsumePlan({
        periodicGranted: 0,
        periodicUsed: 0,
        eventAvailable: 0,
      }),
    ).toThrow('当前无可用补签额度')
  })
})
