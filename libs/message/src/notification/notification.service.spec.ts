import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { QueryUserNotificationListDto } from './dto/notification.dto'
import { MessageNotificationService } from './notification.service'

describe('messageNotificationService', () => {
  let service: MessageNotificationService
  let drizzle: any
  let realtimeService: any
  let inboxService: any
  let updateWhereMock: jest.Mock

  beforeEach(() => {
    updateWhereMock = jest.fn().mockResolvedValue({ rowCount: 1 })

    drizzle = {
      db: {
        $count: jest.fn().mockResolvedValue(3),
        query: {
          appUser: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 9,
                nickname: '回复者',
                avatarUrl: 'https://example.com/avatar.png',
              },
            ]),
          },
        },
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: updateWhereMock,
          })),
        })),
      },
      schema: {
        userNotification: {},
      },
      ext: {
        findPagination: jest.fn().mockResolvedValue({
          list: [
            {
              id: 101,
              receiverUserId: 7,
              categoryKey: 'comment_reply',
              projectionKey: 'comment-replied:101:receiver:7',
              actorUserId: 9,
              title: '有人回复了你的评论',
              content: '回复内容',
              payload: { replyCommentId: 101 },
              isRead: false,
              readAt: null,
              expiresAt: null,
              createdAt: new Date('2026-04-13T00:00:00.000Z'),
              updatedAt: new Date('2026-04-13T00:00:00.000Z'),
            },
          ],
          total: 1,
          pageIndex: 1,
          pageSize: 10,
        }),
      },
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    }

    realtimeService = {
      emitNotificationReadSync: jest.fn(),
      emitInboxSummaryUpdated: jest.fn(),
    }

    inboxService = {
      getSummary: jest.fn().mockResolvedValue({
        notificationUnreadCount: 1,
        chatUnreadCount: 0,
        totalUnreadCount: 1,
      }),
    }

    service = new MessageNotificationService(
      drizzle,
      realtimeService,
      inboxService,
    )
  })

  it('分页查询会返回公开通知视图，不暴露 projectionKey 且 payload 保持对象', async () => {
    const result = await service.queryUserNotificationList(7, {
      pageIndex: 1,
      pageSize: 10,
    } as any)

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        categoryKey: 'comment_reply',
        categoryLabel: '评论回复',
        payload: {
          replyCommentId: 101,
        },
        actorUser: expect.objectContaining({
          id: 9,
          nickname: '回复者',
        }),
      }),
    )
    expect(result.list[0]).not.toHaveProperty('projectionKey')
  })

  it('queryUserNotificationListDto 支持 categoryKeys 数组并对单值 query 做数组收敛', () => {
    const dto = plainToInstance(QueryUserNotificationListDto, {
      categoryKeys: 'comment_reply',
    })

    const errors = validateSync(dto)

    expect(errors).toHaveLength(0)
    expect(dto.categoryKeys).toEqual(['comment_reply'])
  })

  it('queryUserNotificationListDto 会拦截非法 categoryKeys', () => {
    const dto = plainToInstance(QueryUserNotificationListDto, {
      categoryKeys: ['comment_reply', 'unknown_key'],
    })

    const errors = validateSync(dto)

    expect(errors).not.toHaveLength(0)
  })

  it('会把 categoryKeys 归一化为去重数组', () => {
    const result = (service as any).normalizeCategoryKeysFilter([
      'comment_reply',
      'comment_like',
      'comment_reply',
    ])

    expect(result).toEqual(['comment_reply', 'comment_like'])
  })

  it('未读数量只走当前读模型统计入口', async () => {
    const result = await service.getUnreadCount(7)
    expect(result).toEqual({ count: 3 })
    expect(drizzle.db.$count).toHaveBeenCalledTimes(1)
  })

  it('标记单条已读后会发实时同步并刷新收件箱摘要', async () => {
    const result = await service.markRead(7, 101)

    expect(result).toBe(true)
    expect(realtimeService.emitNotificationReadSync).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        id: 101,
      }),
    )
    expect(realtimeService.emitInboxSummaryUpdated).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        notificationUnreadCount: 1,
      }),
    )
  })
})
