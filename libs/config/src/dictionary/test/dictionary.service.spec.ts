import { systemDictionaryItem } from '@db/schema'
import { asc } from 'drizzle-orm'

jest.mock('@db/core', () => ({
  buildILikeCondition: jest.fn((_column: unknown, value?: string) =>
    value ? { type: 'ilike', value } : undefined,
  ),
  buildLikePattern: jest.fn((value?: string) =>
    value?.trim() ? `%${value.trim()}%` : undefined,
  ),
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

function createEmptyPage() {
  return {
    list: [],
    total: 0,
    pageIndex: 1,
    pageSize: 20,
    totalPage: 0,
  }
}

describe('dictionary service sort order', () => {
  it('uses sortOrder asc for dictionary item pagination when orderBy is blank', async () => {
    const { LibDictionaryService } = await import('../dictionary.service')
    const findPagination = jest.fn().mockResolvedValue(createEmptyPage())
    const service = new LibDictionaryService({
      ext: { findPagination },
      schema: { systemDictionaryItem },
    } as any)

    await service.findDictionaryItems({
      dictionaryCode: 'work-language',
      orderBy: '   ',
    } as any)

    expect(findPagination).toHaveBeenCalledWith(
      systemDictionaryItem,
      expect.objectContaining({
        orderBy: { sortOrder: 'asc' },
      }),
    )
  })

  it('adds id as the stable tiebreaker for enabled dictionary items', async () => {
    const { LibDictionaryService } = await import('../dictionary.service')
    const findMany = jest.fn().mockResolvedValue([])
    const service = new LibDictionaryService({
      db: {
        query: {
          systemDictionaryItem: { findMany },
        },
      },
      schema: { systemDictionaryItem },
    } as any)

    await service.findAllDictionaryItems({
      dictionaryCode: 'work-language',
    })

    const options = findMany.mock.calls[0][0]
    const orderBy = options.orderBy(systemDictionaryItem, { asc })

    expect(orderBy).toHaveLength(2)
  })
})
