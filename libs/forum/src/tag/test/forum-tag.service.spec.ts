import { forumTag } from '@db/schema'
import { asc } from 'drizzle-orm'

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

describe('forum tag service sort order', () => {
  it('uses sortOrder asc for tag pagination when orderBy is blank', async () => {
    const { ForumTagService } = await import('../forum-tag.service')
    const findPagination = jest.fn().mockResolvedValue(createEmptyPage())
    const service = new ForumTagService({
      ext: { findPagination },
      schema: { forumTag },
    } as any)

    await service.getTags({ orderBy: '   ' } as any)

    expect(findPagination).toHaveBeenCalledWith(
      forumTag,
      expect.objectContaining({
        orderBy: { sortOrder: 'asc' },
      }),
    )
  })

  it('keeps explicit user orderBy for tag pagination', async () => {
    const { ForumTagService } = await import('../forum-tag.service')
    const findPagination = jest.fn().mockResolvedValue(createEmptyPage())
    const service = new ForumTagService({
      ext: { findPagination },
      schema: { forumTag },
    } as any)

    await service.getTags({ orderBy: '{"id":"desc"}' } as any)

    expect(findPagination).toHaveBeenCalledWith(
      forumTag,
      expect.objectContaining({
        orderBy: '{"id":"desc"}',
      }),
    )
  })

  it('adds id as the stable tiebreaker for enabled tags', async () => {
    const { ForumTagService } = await import('../forum-tag.service')
    const findMany = jest.fn().mockResolvedValue([])
    const service = new ForumTagService({
      db: {
        query: {
          forumTag: { findMany },
        },
      },
      schema: { forumTag },
    } as any)

    await service.getEnabledTags()

    const options = findMany.mock.calls[0][0]
    const orderBy = options.orderBy(forumTag, { asc })

    expect(orderBy).toHaveLength(2)
  })
})
