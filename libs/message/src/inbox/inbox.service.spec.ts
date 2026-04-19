import type { DrizzleService } from '@db/core'
import { MessageInboxService } from './inbox.service'

const EXPECTED_UNREAD_BY_CATEGORY = {
  comment_reply: 0,
  comment_mention: 0,
  comment_like: 2,
  topic_like: 1,
  topic_favorited: 0,
  topic_commented: 0,
  topic_mentioned: 0,
  user_followed: 0,
  system_announcement: 0,
  task_reminder: 0,
} as const

function createDrizzleStub() {
  const countMock = jest.fn().mockResolvedValue(3)
  const chatUnreadRows = [{ unreadCount: 5 }]
  const notificationUnreadRows = [
    { categoryKey: 'comment_like', count: 2 },
    { categoryKey: 'topic_like', count: 1 },
  ]
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
          where: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockResolvedValue(notificationUnreadRows),
        }))
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
      notificationUnread: {
        total: 3,
        byCategory: EXPECTED_UNREAD_BY_CATEGORY,
      },
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

  it('keeps the current public byCategory key set explicit in the summary contract', async () => {
    const drizzle = createDrizzleStub()
    const service = new MessageInboxService(drizzle)

    const result = await service.getNotificationSummary(7)

    expect(result.notificationUnread.byCategory).toEqual(
      EXPECTED_UNREAD_BY_CATEGORY,
    )
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
