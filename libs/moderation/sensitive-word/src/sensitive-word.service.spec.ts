import { SensitiveWordService } from './sensitive-word.service'

describe('SensitiveWordService', () => {
  it('applies a stable default order when querying the sensitive-word page', async () => {
    const findPagination = jest.fn().mockResolvedValue({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 20,
    })
    const drizzle = {
      db: {},
      schema: {
        sensitiveWord: {},
      },
      ext: {
        findPagination,
      },
    }
    const service = new SensitiveWordService(
      drizzle as never,
      {} as never,
      {} as never,
      {} as never,
    )

    await service.getSensitiveWordPage({ pageIndex: 1, pageSize: 20 } as never)

    expect(findPagination).toHaveBeenCalledWith(
      drizzle.schema.sensitiveWord,
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    )
  })
})
