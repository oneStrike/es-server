/// <reference types="jest" />

import { ForumHashtagService } from './forum-hashtag.service'

function createSelectBuilder<TResult>(
  result: TResult,
  recorder: Record<string, ReturnType<typeof jest.fn>> = {},
) {
  const promise = Promise.resolve(result)
  const builder: Record<string, ReturnType<typeof jest.fn>> & {
    then: Promise<TResult>['then']
    catch: Promise<TResult>['catch']
    finally: Promise<TResult>['finally']
  } = {
    from: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    offset: jest.fn(async () => result),
    orderBy: jest.fn(() => builder),
    where: jest.fn(() => builder),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }

  Object.assign(recorder, builder)
  return builder
}

describe('ForumHashtagService app page contract', () => {
  it('returns standard page result for hot hashtags', async () => {
    const selectRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
    const rows = [
      {
        id: 1,
        slug: 'typescript',
        displayName: 'TypeScript',
        description: null,
        topicRefCount: 3,
        commentRefCount: 2,
        followerCount: 4,
        lastReferencedAt: new Date('2026-06-01T00:00:00.000Z'),
        hotScore: 50,
      },
    ]
    const drizzle = {
      db: {
        select: jest.fn(() => createSelectBuilder(rows, selectRecorder)),
        $count: jest.fn(async () => 1),
      },
      schema: {
        forumHashtag: {
          auditStatus: 'auditStatus',
          commentRefCount: 'commentRefCount',
          deletedAt: 'deletedAt',
          description: 'description',
          displayName: 'displayName',
          followerCount: 'followerCount',
          id: 'id',
          isHidden: 'isHidden',
          lastReferencedAt: 'lastReferencedAt',
          manualBoost: 'manualBoost',
          slug: 'slug',
          topicRefCount: 'topicRefCount',
        },
      },
      buildPage: jest.fn(() => ({
        limit: 5,
        offset: 5,
        pageIndex: 2,
        pageSize: 5,
      })),
      buildPageParams: jest.fn(() => ({
        page: {
          limit: 5,
          offset: 5,
          pageIndex: 2,
          pageSize: 5,
        },
        order: {
          orderBySql: ['order-sql'],
        },
        dateRange: undefined,
      })),
    }
    const service = new ForumHashtagService(
      drizzle as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    ) as any
    jest
      .spyOn(service, 'getFollowedMap')
      .mockResolvedValue(new Map([[1, true]]))

    const page = await service.getHotHashtagPage({
      pageIndex: 2,
      pageSize: 5,
    })

    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      {
        pageIndex: 2,
        pageSize: 5,
      },
      expect.any(Object),
    )
    expect(selectRecorder.limit).toHaveBeenCalledWith(5)
    expect(selectRecorder.offset).toHaveBeenCalledWith(5)
    expect(drizzle.db.$count).toHaveBeenCalled()
    expect(page).toEqual(
      expect.objectContaining({
        total: 1,
        pageIndex: 2,
        pageSize: 5,
      }),
    )
    expect(page.list[0]).toEqual(
      expect.objectContaining({
        id: 1,
        isFollowed: true,
      }),
    )
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })
})
