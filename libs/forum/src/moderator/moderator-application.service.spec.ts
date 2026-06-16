/// <reference types="jest" />

import { ForumModeratorApplicationService } from './moderator-application.service'
import { ForumModeratorApplicationStatusEnum } from './moderator-application.constant'

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

describe('ForumModeratorApplicationService app page contract', () => {
  it('returns standard page result for my applications', async () => {
    const selectRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
    const applicationRows = [
      {
        id: 1,
        applicantId: 10,
        sectionId: 20,
        status: ForumModeratorApplicationStatusEnum.PENDING,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ]
    const drizzle = {
      db: {
        select: jest.fn(() =>
          createSelectBuilder(applicationRows, selectRecorder),
        ),
        $count: jest.fn(async () => 1),
      },
      schema: {
        forumModeratorApplication: {
          applicantId: 'applicantId',
          createdAt: 'createdAt',
          deletedAt: 'deletedAt',
          id: 'id',
          sectionId: 'sectionId',
          status: 'status',
        },
      },
      buildPage: jest.fn(() => ({
        limit: 5,
        offset: 10,
        pageIndex: 3,
        pageSize: 5,
      })),
      buildPageParams: jest.fn(() => ({
        page: {
          limit: 5,
          offset: 10,
          pageIndex: 3,
          pageSize: 5,
        },
        order: {
          orderBySql: ['createdAtDesc'],
        },
        dateRange: undefined,
      })),
    }
    const service = new ForumModeratorApplicationService(
      drizzle as any,
      {} as any,
      {} as any,
    ) as any
    jest.spyOn(service, 'buildApplicationViews').mockResolvedValue([
      {
        id: 1,
        applicantId: 10,
        sectionId: 20,
        status: ForumModeratorApplicationStatusEnum.PENDING,
      },
    ])

    const page = await service.getMyApplicationPage(10, {
      pageIndex: 3,
      pageSize: 5,
    })

    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      {
        pageIndex: 3,
        pageSize: 5,
      },
      expect.any(Object),
    )
    expect(selectRecorder.limit).toHaveBeenCalledWith(5)
    expect(selectRecorder.offset).toHaveBeenCalledWith(10)
    expect(drizzle.db.$count).toHaveBeenCalled()
    expect(page).toEqual(
      expect.objectContaining({
        total: 1,
        pageIndex: 3,
        pageSize: 5,
      }),
    )
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })
})
