/// <reference types="jest" />

import { UserProfileService } from './profile.service'

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
    offset: jest.fn(() => builder),
    orderBy: jest.fn(async () => result),
    where: jest.fn(() => builder),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }

  Object.assign(recorder, builder)
  return builder
}

function createProfileService() {
  const topicRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
  const topicRows = [
    {
      id: 1,
      sectionId: 2,
      userId: 10,
      title: '主题',
      contentPreview: '摘要',
      geoCountry: null,
      geoProvince: null,
      geoCity: null,
      geoIsp: null,
      images: [],
      videos: [],
      isPinned: false,
      isFeatured: false,
      isLocked: false,
      viewCount: 1,
      commentCount: 2,
      likeCount: 3,
      favoriteCount: 4,
      lastCommentAt: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      auditStatus: 1,
    },
  ]
  const sectionRows = [
    {
      id: 2,
      name: '综合',
      icon: null,
      cover: null,
    },
  ]
  let selectCall = 0
  const drizzle = {
    db: {
      select: jest.fn(() => {
        selectCall += 1
        return createSelectBuilder(
          selectCall === 1 ? topicRows : sectionRows,
          selectCall === 1 ? topicRecorder : {},
        )
      }),
      $count: jest.fn(async () => 1),
    },
    schema: {
      forumTopic: {
        auditStatus: 'auditStatus',
        commentCount: 'commentCount',
        contentPreview: 'contentPreview',
        createdAt: 'createdAt',
        deletedAt: 'deletedAt',
        favoriteCount: 'favoriteCount',
        geoCity: 'geoCity',
        geoCountry: 'geoCountry',
        geoIsp: 'geoIsp',
        geoProvince: 'geoProvince',
        id: 'id',
        images: 'images',
        isFeatured: 'isFeatured',
        isHidden: 'isHidden',
        isLocked: 'isLocked',
        isPinned: 'isPinned',
        lastCommentAt: 'lastCommentAt',
        likeCount: 'likeCount',
        sectionId: 'sectionId',
        title: 'title',
        userId: 'userId',
        videos: 'videos',
        viewCount: 'viewCount',
      },
      forumSection: {
        cover: 'cover',
        deletedAt: 'deletedAt',
        icon: 'icon',
        id: 'id',
        name: 'name',
      },
    },
    buildOrderBy: jest.fn(() => ({ orderBySql: ['createdAtDesc'] })),
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
        orderBySql: ['createdAtDesc'],
      },
      dateRange: undefined,
    })),
  }
  const likeService = {
    checkStatusBatch: jest.fn(async () => new Map([[1, true]])),
  }
  const favoriteService = {
    checkStatusBatch: jest.fn(async () => new Map([[1, false]])),
  }
  const service = new UserProfileService(
    drizzle as any,
    favoriteService as any,
    likeService as any,
    {} as any,
    {} as any,
  ) as any
  jest.spyOn(service, 'getTopicUserBriefById').mockResolvedValue({
    id: 10,
    nickname: '作者',
    avatarUrl: null,
  })
  jest
    .spyOn(service, 'resolvePublicUserTopicVisibleSectionIds')
    .mockResolvedValue([2])

  return { drizzle, service, topicRecorder }
}

describe('UserProfileService topic page contract', () => {
  it('returns standard page result for public user topics', async () => {
    const { drizzle, service, topicRecorder } = createProfileService()

    const page = await service.getPublicUserTopics(10, 20, {
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
    expect(topicRecorder.limit).toHaveBeenCalledWith(5)
    expect(topicRecorder.offset).toHaveBeenCalledWith(5)
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
        liked: true,
        favorited: false,
      }),
    )
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })

  it('returns standard page result for my topics', async () => {
    const { drizzle, service, topicRecorder } = createProfileService()

    const page = await service.getMyTopics(10, {
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
    expect(topicRecorder.limit).toHaveBeenCalledWith(5)
    expect(topicRecorder.offset).toHaveBeenCalledWith(5)
    expect(drizzle.db.$count).toHaveBeenCalled()
    expect(page).toEqual(
      expect.objectContaining({
        total: 1,
        pageIndex: 2,
        pageSize: 5,
      }),
    )
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })
})
