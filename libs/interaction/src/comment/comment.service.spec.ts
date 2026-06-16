import * as schema from '@db/schema'
import { sql } from 'drizzle-orm'
import { CommentTargetTypeEnum } from './comment.constant'
import { CommentService } from './comment.service'

function createSelectChain(rows: unknown[]) {
  const chain = {
    from: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    offset: jest.fn(async () => rows),
    orderBy: jest.fn(() => chain),
    where: jest.fn(() => chain),
  }

  return chain
}

function createSubject(rows: unknown[] = []) {
  const pageQuery = {
    limit: 20,
    offset: 40,
    pageIndex: 3,
    pageSize: 20,
  }
  const selectChain = createSelectChain(rows)
  const drizzle = {
    buildPage: jest.fn(() => pageQuery),
    buildPageParams: jest.fn(() => ({
      page: pageQuery,
      order: {
        orderByClause: sql.raw('created_at desc'),
        orderBySql: [],
      },
      dateRange: undefined,
    })),
    db: {
      $count: jest.fn(async () => 12),
      select: jest.fn(() => selectChain),
    },
    schema,
  }

  const service = new (CommentService as any)(
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    drizzle,
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
  ) as CommentService

  return {
    drizzle,
    pageQuery,
    selectChain,
    service,
  }
}

describe('CommentService app page contract', () => {
  it('uses offset pagination and count for target comments', async () => {
    const { drizzle, pageQuery, selectChain, service } = createSubject()

    const page = await service.getTargetComments({
      targetId: 10,
      targetType: CommentTargetTypeEnum.COMIC,
      pageIndex: 3,
      pageSize: 20,
    })

    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({
        pageIndex: 3,
        pageSize: 20,
      }),
      expect.any(Object),
    )
    expect(selectChain.limit).toHaveBeenCalledWith(pageQuery.limit)
    expect(selectChain.offset).toHaveBeenCalledWith(pageQuery.offset)
    expect(drizzle.db.$count).toHaveBeenCalledWith(
      schema.userComment,
      expect.anything(),
    )
    expect(page).toEqual({
      list: [],
      total: 12,
      pageIndex: 3,
      pageSize: 20,
    })
  })
})
