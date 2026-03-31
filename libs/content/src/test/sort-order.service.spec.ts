import { workCategory, workTag } from '@db/schema'

jest.mock('@db/core', () => ({
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

describe('content sort order defaults', () => {
  it('uses maxOrder to append the next category sortOrder', async () => {
    const { WorkCategoryService } = await import('../category/category.service')
    const maxOrder = jest.fn().mockResolvedValue(4)
    const values = jest.fn().mockResolvedValue(undefined)
    const insert = jest.fn(() => ({ values }))
    const withErrorHandling = jest.fn(async (handler: () => Promise<unknown>) =>
      handler()
    )
    const service = new WorkCategoryService({
      db: { insert },
      ext: { maxOrder },
      withErrorHandling,
      schema: { workCategory },
    } as any)

    await service.createCategory({ name: '分类' } as any)

    expect(maxOrder).toHaveBeenCalledWith({
      column: workCategory.sortOrder,
    })
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        sortOrder: 5,
      }),
    )
  })

  it('uses sortOrder asc for category pagination when orderBy is blank', async () => {
    const { WorkCategoryService } = await import('../category/category.service')
    const findPagination = jest.fn().mockResolvedValue(createEmptyPage())
    const service = new WorkCategoryService({
      ext: { findPagination },
      schema: { workCategory },
    } as any)

    await service.getCategoryPage({
      contentType: '[]',
      orderBy: '   ',
    } as any)

    expect(findPagination).toHaveBeenCalledWith(
      workCategory,
      expect.objectContaining({
        orderBy: { sortOrder: 'asc' },
      }),
    )
  })

  it('uses maxOrder to append the next tag sortOrder', async () => {
    const { WorkTagService } = await import('../tag/tag.service')
    const maxOrder = jest.fn().mockResolvedValue(6)
    const values = jest.fn().mockResolvedValue(undefined)
    const insert = jest.fn(() => ({ values }))
    const withErrorHandling = jest.fn(async (handler: () => Promise<unknown>) =>
      handler()
    )
    const service = new WorkTagService({
      db: { insert },
      ext: { maxOrder },
      withErrorHandling,
      schema: { workTag },
    } as any)

    await service.createTag({ name: '标签' } as any)

    expect(maxOrder).toHaveBeenCalledWith({
      column: workTag.sortOrder,
    })
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        sortOrder: 7,
      }),
    )
  })

  it('uses sortOrder asc for tag pagination when orderBy is missing', async () => {
    const { WorkTagService } = await import('../tag/tag.service')
    const findPagination = jest.fn().mockResolvedValue(createEmptyPage())
    const service = new WorkTagService({
      ext: { findPagination },
      schema: { workTag },
    } as any)

    await service.getTagPage({} as any)

    expect(findPagination).toHaveBeenCalledWith(
      workTag,
      expect.objectContaining({
        orderBy: { sortOrder: 'asc' },
      }),
    )
  })
})
