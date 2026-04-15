import { SensitiveWordLevelEnum, SensitiveWordTypeEnum } from './sensitive-word-constant'
import { SensitiveWordStatisticsService } from './sensitive-word-statistics.service'

describe('sensitiveWordStatisticsService', () => {
  let service: SensitiveWordStatisticsService
  let drizzle: any
  let selectMock: jest.Mock

  beforeEach(() => {
    selectMock = jest.fn()
    drizzle = {
      db: {
        select: selectMock,
      },
      schema: {
        sensitiveWord: {
          id: 'sensitiveWord.id',
          word: 'sensitiveWord.word',
          level: 'sensitiveWord.level',
          type: 'sensitiveWord.type',
          isEnabled: 'sensitiveWord.isEnabled',
          hitCount: 'sensitiveWord.hitCount',
          lastHitAt: 'sensitiveWord.lastHitAt',
        },
        sensitiveWordHitLog: {
          id: 'hitLog.id',
          sensitiveWordId: 'hitLog.sensitiveWordId',
          matchedWord: 'hitLog.matchedWord',
          level: 'hitLog.level',
          type: 'hitLog.type',
          entityType: 'hitLog.entityType',
          entityId: 'hitLog.entityId',
          operationType: 'hitLog.operationType',
          createdAt: 'hitLog.createdAt',
        },
      },
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    }

    service = new SensitiveWordStatisticsService(drizzle)
  })

  it('完整统计在历史命中未回填前继续沿用词表快照口径', async () => {
    const queue = [
      { stage: 'fromOnly', result: [{ count: 2 }] },
      { stage: 'whereOnly', result: [{ count: 2 }] },
      { stage: 'whereOnly', result: [{ count: 0 }] },
      { stage: 'fromOnly', result: [{ sum: 100 }] },
      { stage: 'whereOnly', result: [{ sum: 11 }] },
      { stage: 'whereOnly', result: [{ sum: 23 }] },
      { stage: 'whereOnly', result: [{ sum: 57 }] },
      {
        stage: 'groupBy',
        result: [{ level: SensitiveWordLevelEnum.SEVERE, count: 1, hitCount: 100 }],
      },
      {
        stage: 'groupBy',
        result: [{ type: SensitiveWordTypeEnum.AD, count: 1, hitCount: 100 }],
      },
      {
        stage: 'ordered',
        result: [
          {
            word: '测试',
            hitCount: 5,
            level: SensitiveWordLevelEnum.SEVERE,
            type: SensitiveWordTypeEnum.AD,
            lastHitAt: new Date('2026-04-15T10:00:00.000Z'),
          },
        ],
      },
      {
        stage: 'ordered',
        result: [
          {
            word: '测试',
            hitCount: 2,
            level: SensitiveWordLevelEnum.SEVERE,
            type: SensitiveWordTypeEnum.AD,
            lastHitAt: new Date('2026-04-15T10:00:00.000Z'),
          },
        ],
      },
    ]

    selectMock.mockImplementation(() => {
      const next = queue.shift()
      if (next?.stage === 'fromOnly') {
        return {
          from: jest.fn(() => next.result),
        }
      }

      if (next?.stage === 'whereOnly') {
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => next.result),
          })),
        }
      }

      if (next?.stage === 'groupBy') {
        return {
          from: jest.fn(() => ({
            groupBy: jest.fn(() => next.result),
          })),
        }
      }

      if (next?.stage === 'ordered') {
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => next.result),
              })),
            })),
          })),
        }
      }

      return {
        from: jest.fn(() => next?.result),
      }
    })

    const result = await service.getStatistics()

    expect(result.totalHits).toBe(100)
    expect(result.todayHits).toBe(11)
    expect(result.lastWeekHits).toBe(23)
    expect(result.lastMonthHits).toBe(57)
    expect(result.topHitWords).toEqual([
      expect.objectContaining({
        word: '测试',
        hitCount: 5,
      }),
    ])
    expect(result.recentHitWords).toEqual([
      expect.objectContaining({
        word: '测试',
        hitCount: 2,
      }),
    ])
  })

  it('事务内记录命中会批量写明细并聚合更新词表快照', async () => {
    const valuesMock = jest.fn().mockResolvedValue(undefined)
    const setMock = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    })
    const tx = {
      insert: jest.fn().mockReturnValue({
        values: valuesMock,
      }),
      update: jest.fn().mockReturnValue({
        set: setMock,
      }),
    }

    await (service as any).recordEntityHitsInTx(tx, {
      entityType: 'topic',
      entityId: 101,
      operationType: 'create',
      hits: [
        {
          sensitiveWordId: 1,
          word: '测试',
          start: 0,
          end: 1,
          level: SensitiveWordLevelEnum.SEVERE,
          type: SensitiveWordTypeEnum.AD,
        },
        {
          sensitiveWordId: 1,
          word: '测试',
          start: 5,
          end: 6,
          level: SensitiveWordLevelEnum.SEVERE,
          type: SensitiveWordTypeEnum.AD,
        },
        {
          sensitiveWordId: 2,
          word: '禁止',
          start: 8,
          end: 9,
          level: SensitiveWordLevelEnum.GENERAL,
          type: SensitiveWordTypeEnum.OTHER,
        },
      ],
    })

    expect(tx.insert).toHaveBeenCalled()
    expect(valuesMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sensitiveWordId: 1,
          entityId: 101,
        }),
        expect.objectContaining({
          sensitiveWordId: 2,
          entityId: 101,
        }),
      ]),
    )
    expect(tx.update).toHaveBeenCalledTimes(2)
  })
})
