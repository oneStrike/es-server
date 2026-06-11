/// <reference types="jest" />

import { workTag } from '@db/schema'
import { BadRequestException } from '@nestjs/common'
import { WorkTagService } from './tag.service'

const now = new Date('2026-06-11T00:00:00.000Z')

function createTag(overrides: Partial<typeof workTag.$inferSelect>) {
  return {
    id: 1,
    name: '标签',
    icon: null,
    description: null,
    sortOrder: 0,
    isEnabled: true,
    popularity: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function createSubject(rows: Array<typeof workTag.$inferSelect>) {
  const query = {
    from: jest.fn(() => query),
    where: jest.fn(() => query),
    orderBy: jest.fn(() => query),
    limit: jest.fn(async () => rows),
  }
  const drizzle = {
    db: {
      select: jest.fn(() => query),
      $count: jest.fn(),
    },
    schema: {
      workTag,
      workTagRelation: {},
      work: {},
    },
    buildPage: jest.fn((queryDto: { pageSize?: number }) => ({
      limit: queryDto.pageSize ?? 15,
      offset: 0,
      pageIndex: 1,
      pageSize: queryDto.pageSize ?? 15,
    })),
  }

  return {
    drizzle,
    query,
    service: new WorkTagService(drizzle as never) as any,
  }
}

describe('WorkTagService app cursor pagination', () => {
  it('uses sortOrder/id cursor result shape without exact count', async () => {
    const rows = [
      createTag({ id: 20, name: 'A', sortOrder: 2 }),
      createTag({ id: 21, name: 'B', sortOrder: 2 }),
      createTag({ id: 22, name: 'C', sortOrder: 2 }),
    ]
    const { drizzle, query, service } = createSubject(rows)

    const result = await service.getAppTagCursorPage({ pageSize: 2 })
    const decodedCursor = JSON.parse(
      Buffer.from(result.nextCursor, 'base64url').toString('utf8'),
    )

    expect(result).toMatchObject({
      pageSize: 2,
      hasMore: true,
      list: [
        { id: 20, sortOrder: 2 },
        { id: 21, sortOrder: 2 },
      ],
    })
    expect(result).not.toHaveProperty('total')
    expect(result).not.toHaveProperty('pageIndex')
    expect(decodedCursor).toEqual({
      sortOrder: 2,
      id: 21,
      context: {
        name: null,
      },
    })
    expect(query.limit).toHaveBeenCalledWith(3)
    expect(query.orderBy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
    )
    expect(drizzle.db.$count).not.toHaveBeenCalled()
  })

  it('rejects invalid app tag cursors', () => {
    const { service } = createSubject([])

    expect(() => service.parseTagCursor('not-base64-json')).toThrow(
      BadRequestException,
    )
  })

  it('rejects app tag cursors when filter context changes', () => {
    const { service } = createSubject([])
    const context = service.buildTagCursorContext({ name: '  Hot ' })
    const cursor = service.encodeTagCursor(
      createTag({ id: 21, sortOrder: 2 }),
      context,
    )

    expect(
      service.parseTagCursor(
        cursor,
        service.buildTagCursorContext({ name: 'hot' }),
      ),
    ).toEqual({ sortOrder: 2, id: 21 })
    expect(() =>
      service.parseTagCursor(
        cursor,
        service.buildTagCursorContext({ name: 'cold' }),
      ),
    ).toThrow('查询条件不匹配')
  })
})
