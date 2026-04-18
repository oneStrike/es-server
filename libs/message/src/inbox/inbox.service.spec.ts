import type { DrizzleService } from '@db/core'
import { MessageInboxService } from './inbox.service'

function createDrizzleStub() {
  const countMock = jest.fn().mockResolvedValue(3)
  const chatUnreadRows = [{ unreadCount: 5 }]
  const latestNotificationRows = [
    {
      id: 101,
      categoryKey: 'comment_like',
      title: '有人点赞了你的评论',
      content: '评论内容',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      expiresAt: null,
    },
  ]

  const drizzle = {
    db: {
      $count: countMock,
      select: jest
        .fn()
        .mockImplementationOnce(() => ({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue(chatUnreadRows),
        }))
        .mockImplementationOnce(() => ({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue(latestNotificationRows),
        })),
      query: {
        chatMessage: {
          findFirst: jest.fn(),
        },
      },
      execute: jest.fn(),
    },
    schema: {
      userNotification: {
        id: 'id',
        categoryKey: 'categoryKey',
        title: 'title',
        content: 'content',
        createdAt: 'createdAt',
        expiresAt: 'expiresAt',
        receiverUserId: 'receiverUserId',
        isRead: 'isRead',
      },
      chatConversation: {},
      chatConversationMember: {
        conversationId: 'conversationId',
        unreadCount: 'unreadCount',
        userId: 'userId',
        leftAt: 'leftAt',
      },
      chatMessage: {},
    },
  } as unknown as DrizzleService

  return drizzle
}

describe('messageInboxService', () => {
  it('builds a notification-driven summary without loading latest chat message content', async () => {
    const drizzle = createDrizzleStub()
    const service = new MessageInboxService(drizzle)

    const result = await service.getNotificationSummary(7)

    expect(result).toEqual({
      notificationUnreadCount: 3,
      chatUnreadCount: 5,
      totalUnreadCount: 8,
      latestNotification: {
        id: 101,
        categoryKey: 'comment_like',
        categoryLabel: '评论点赞',
        title: '有人点赞了你的评论',
        content: '评论内容',
        createdAt: new Date('2026-04-18T00:00:00.000Z'),
      },
    })
    expect(drizzle.db.query.chatMessage.findFirst).not.toHaveBeenCalled()
  })

  it('uses database-level merged pagination for inbox timeline', async () => {
    const drizzle = createDrizzleStub() as DrizzleService & {
      db: Record<string, jest.Mock>
      buildPage: jest.Mock
    }
    drizzle.buildPage = jest.fn().mockReturnValue({
      pageIndex: 2,
      pageSize: 2,
      limit: 2,
      offset: 2,
    })
    ;(drizzle.db.execute as jest.Mock).mockResolvedValue({
      rows: [
        {
          sourceType: 'notification',
          createdAt: new Date('2026-04-18T00:00:00.000Z'),
          title: '通知标题',
          content: '通知内容',
          bizId: 'n:101',
        },
        {
          sourceType: 'chat',
          createdAt: new Date('2026-04-17T00:00:00.000Z'),
          title: '新聊天消息',
          content: '最后消息',
          bizId: 'c:8',
        },
      ],
    })
    drizzle.db.$count = jest.fn().mockResolvedValue(3)
    drizzle.db.select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([{ total: 4 }]),
    })
    const service = new MessageInboxService(drizzle)

    const result = await service.getTimeline(7, {} as never)

    expect(result).toEqual({
      list: [
        {
          sourceType: 'notification',
          createdAt: new Date('2026-04-18T00:00:00.000Z'),
          title: '通知标题',
          content: '通知内容',
          bizId: 'n:101',
        },
        {
          sourceType: 'chat',
          createdAt: new Date('2026-04-17T00:00:00.000Z'),
          title: '新聊天消息',
          content: '最后消息',
          bizId: 'c:8',
        },
      ],
      total: 7,
      pageIndex: 2,
      pageSize: 2,
    })
    expect(drizzle.db.execute).toHaveBeenCalledTimes(1)
  })
})
