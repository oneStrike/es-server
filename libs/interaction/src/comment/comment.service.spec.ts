import * as schema from '@db/schema'
import { CommentTargetTypeEnum } from './comment.constant'
import { CommentService } from './comment.service'

describe('commentService', () => {
  let service: CommentService
  let drizzle: any
  let findPaginationMock: jest.Mock
  let selectWhereMock: jest.Mock
  let likeService: { checkStatusBatch: jest.Mock }

  beforeEach(() => {
    findPaginationMock = jest.fn()
    selectWhereMock = jest.fn()

    drizzle = {
      db: {
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: selectWhereMock,
          })),
        })),
      },
      ext: {
        findPagination: findPaginationMock,
      },
      schema,
    }

    likeService = {
      checkStatusBatch: jest.fn().mockResolvedValue(new Map([[11, true]])),
    }

    service = new CommentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      likeService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      drizzle,
    )
  })

  it('评论回复分页不会返回 geoSource', async () => {
    findPaginationMock.mockResolvedValue({
      list: [
        {
          id: 11,
          targetType: CommentTargetTypeEnum.FORUM_TOPIC,
          targetId: 7,
          userId: 3,
          content: '回复内容',
          bodyTokens: null,
          floor: 2,
          replyToId: 1,
          likeCount: 0,
          geoCountry: '中国',
          geoProvince: null,
          geoCity: '深圳市',
          geoIsp: '电信',
          geoSource: 'ip2region',
          createdAt: new Date('2026-04-08T00:00:00.000Z'),
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
    })
    selectWhereMock.mockResolvedValue([
      {
        id: 3,
        nickname: '测试用户',
        avatarUrl: null,
      },
    ])

    const result = await service.getReplies({
      commentId: 1,
      pageIndex: 1,
      pageSize: 10,
      userId: 99,
    })

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        id: 11,
        geoCountry: '中国',
        geoProvince: null,
        geoCity: '深圳市',
        geoIsp: '电信',
        liked: true,
      }),
    )
    expect(result.list[0]).not.toHaveProperty('geoSource')
  })

  it('我的评论分页不会返回 geoSource', async () => {
    findPaginationMock.mockResolvedValue({
      list: [
        {
          id: 12,
          targetType: CommentTargetTypeEnum.FORUM_TOPIC,
          targetId: 7,
          userId: 3,
          content: '我的评论',
          bodyTokens: null,
          floor: 1,
          replyToId: null,
          actualReplyToId: null,
          isHidden: false,
          auditStatus: 1,
          auditById: null,
          auditRole: null,
          auditReason: null,
          auditAt: null,
          likeCount: 2,
          sensitiveWordHits: null,
          geoCountry: '中国',
          geoProvince: null,
          geoCity: '深圳市',
          geoIsp: '电信',
          geoSource: 'ip2region',
          deletedAt: null,
          createdAt: new Date('2026-04-08T00:00:00.000Z'),
          updatedAt: new Date('2026-04-08T00:00:00.000Z'),
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
    })

    const result = await service.getUserComments(
      {
        pageIndex: 1,
        pageSize: 10,
      },
      3,
    )

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        id: 12,
        geoCountry: '中国',
        geoCity: '深圳市',
        geoIsp: '电信',
      }),
    )
    expect(result.list[0]).not.toHaveProperty('geoSource')
  })
})
