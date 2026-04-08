import * as schema from '@db/schema'
import { ForumTopicService } from './forum-topic.service'

describe('forumTopicService', () => {
  let service: ForumTopicService
  let drizzle: any
  let selectWhereMock: jest.Mock
  let likeService: { checkStatusBatch: jest.Mock }
  let favoriteService: { checkStatusBatch: jest.Mock }

  beforeEach(() => {
    selectWhereMock = jest.fn()

    drizzle = {
      db: {
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: selectWhereMock,
          })),
        })),
      },
      schema,
    }

    likeService = {
      checkStatusBatch: jest.fn().mockResolvedValue(new Map([[11, true]])),
    }
    favoriteService = {
      checkStatusBatch: jest.fn().mockResolvedValue(new Map([[11, false]])),
    }

    service = new ForumTopicService(
      drizzle,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      likeService as any,
      favoriteService as any,
      {} as any,
      {} as any,
    )
  })

  it('收藏主题分页详情会带出 PublicForumTopicPageItemDto 需要的 geo 字段', async () => {
    selectWhereMock.mockResolvedValue([
      {
        id: 11,
        sectionId: 7,
        userId: 3,
        title: '带属地的主题',
        contentSnippet: '正文摘要',
        geoCountry: '中国',
        geoProvince: null,
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
        images: [],
        videos: [],
        isPinned: false,
        isFeatured: true,
        isLocked: false,
        viewCount: 12,
        commentCount: 5,
        likeCount: 8,
        favoriteCount: 4,
        lastCommentAt: new Date('2026-04-08T00:00:00.000Z'),
        createdAt: new Date('2026-04-07T00:00:00.000Z'),
      },
    ])

    jest
      .spyOn(service as any, 'getTopicSectionBriefMap')
      .mockResolvedValue(new Map([[7, { id: 7, name: '默认板块', icon: null, cover: null }]]))
    jest
      .spyOn(service as any, 'getTopicUserBriefMap')
      .mockResolvedValue(new Map([[3, { id: 3, nickname: '测试用户', avatarUrl: null }]]))

    const result = await service.batchGetFavoriteTopicDetails([11], 99)

    expect(result.get(11)).toEqual(expect.objectContaining({
      id: 11,
      geoCountry: '中国',
      geoProvince: undefined,
      geoCity: '深圳市',
      geoIsp: '电信',
      geoSource: 'ip2region',
      liked: true,
      favorited: false,
    }))
  })
})
