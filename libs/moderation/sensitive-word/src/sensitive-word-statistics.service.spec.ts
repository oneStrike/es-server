import { SensitiveWordStatisticsService } from './sensitive-word-statistics.service'

function createStatisticsHarness() {
  const sensitiveWord = {
    hitCount: Symbol('sensitiveWord.hitCount'),
    lastHitAt: Symbol('sensitiveWord.lastHitAt'),
  }
  const sensitiveWordHitLog = {
    createdAt: Symbol('sensitiveWordHitLog.createdAt'),
  }
  let selectedFrom: unknown
  const db = {
    select: jest.fn(() => ({
      from(table: unknown) {
        selectedFrom = table
        return this
      },
      where: jest.fn().mockImplementation(() =>
        Promise.resolve([
          {
            sum: selectedFrom === sensitiveWordHitLog ? 3 : 99,
          },
        ]),
      ),
    })),
  }
  const drizzle = {
    db,
    schema: {
      sensitiveWord,
      sensitiveWordHitLog,
    },
  }

  return {
    service: new SensitiveWordStatisticsService(drizzle as never),
  }
}

describe('SensitiveWordStatisticsService', () => {
  it('counts time-window hits from hit logs instead of cumulative word snapshots', async () => {
    const harness = createStatisticsHarness()

    const hitCount = await (
      harness.service as unknown as {
        getHitsInDateRange: (startDate: Date) => Promise<number>
      }
    ).getHitsInDateRange(new Date('2026-04-21T00:00:00.000Z'))

    expect(hitCount).toBe(3)
  })
})
