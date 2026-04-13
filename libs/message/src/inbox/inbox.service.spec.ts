import { MessageInboxService } from './inbox.service'

describe('MessageInboxService', () => {
  function createSummaryService() {
    const countMock = jest.fn().mockResolvedValue(1)
    const selectMock = jest
      .fn()
      .mockImplementationOnce(() => ({
        from: jest.fn(() => ({
          where: jest.fn().mockResolvedValue([{ unreadCount: 0 }]),
        })),
      }))
      .mockImplementationOnce(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue([
                {
                  id: 99,
                  categoryKey: 'comment_reply',
                  title: '仍然有效的通知',
                  content: '有效内容',
                  createdAt: new Date('2026-04-13T10:00:00.000Z'),
                  expiresAt: new Date('2026-04-14T10:00:00.000Z'),
                },
              ]),
            })),
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        from: jest.fn(() => ({
          innerJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue([]),
              })),
            })),
          })),
        })),
      }))

    const drizzle = {
      db: {
        $count: countMock,
        select: selectMock,
        query: {
          chatMessage: {
            findFirst: jest.fn(),
          },
        },
      },
      schema: {
        userNotification: {
          receiverUserId: 'receiverUserId',
          expiresAt: 'expiresAt',
          isRead: 'isRead',
        },
        chatConversation: {
          id: 'id',
          lastMessageId: 'lastMessageId',
          lastMessageAt: 'lastMessageAt',
          lastSenderId: 'lastSenderId',
        },
        chatConversationMember: {
          unreadCount: 'unreadCount',
          userId: 'userId',
          leftAt: 'leftAt',
          conversationId: 'conversationId',
        },
        chatMessage: {
          id: 'id',
        },
      },
      buildPage: jest.fn(),
    }

    return {
      service: new MessageInboxService(drizzle as never),
      selectMock,
    }
  }

  function createTimelineService() {
    const countMock = jest.fn().mockResolvedValue(1)
    const selectMock = jest
      .fn()
      .mockImplementationOnce(() => ({
        from: jest.fn(() => ({
          innerJoin: jest.fn(() => ({
            where: jest.fn().mockResolvedValue([{ total: 0 }]),
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue([
                {
                  id: 199,
                  categoryKey: 'comment_reply',
                  title: '仍然有效的通知',
                  content: '有效内容',
                  createdAt: new Date('2026-04-13T10:00:00.000Z'),
                  expiresAt: new Date('2026-04-14T10:00:00.000Z'),
                },
              ]),
            })),
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        from: jest.fn(() => ({
          innerJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue([]),
              })),
            })),
          })),
        })),
      }))

    const drizzle = {
      db: {
        $count: countMock,
        select: selectMock,
        query: {
          chatMessage: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      },
      schema: {
        userNotification: {
          receiverUserId: 'receiverUserId',
          expiresAt: 'expiresAt',
        },
        chatConversation: {
          id: 'id',
          lastMessageId: 'lastMessageId',
          lastMessageAt: 'lastMessageAt',
        },
        chatConversationMember: {
          userId: 'userId',
          leftAt: 'leftAt',
          conversationId: 'conversationId',
        },
        chatMessage: {
          id: 'id',
        },
      },
      buildPage: jest.fn().mockReturnValue({
        pageIndex: 1,
        pageSize: 1,
        offset: 0,
      }),
    }

    return {
      service: new MessageInboxService(drizzle as never),
      selectMock,
    }
  }

  it('getSummary 会回退到最近一条仍有效的通知', async () => {
    const { service, selectMock } = createSummaryService()

    const result = await service.getSummary(7)

    expect(selectMock).toHaveBeenCalled()
    expect(result.latestNotification).toEqual(
      expect.objectContaining({
        id: 99,
        title: '仍然有效的通知',
      }),
    )
  })

  it('getTimeline 只按有效通知取数，避免被顶部过期通知挡住', async () => {
    const { service, selectMock } = createTimelineService()

    const result = await service.getTimeline(7, {
      pageIndex: 1,
      pageSize: 1,
    })

    expect(selectMock).toHaveBeenCalled()
    expect(result.total).toBe(1)
    expect(result.list).toEqual([
      expect.objectContaining({
        bizId: 'n:199',
        title: '仍然有效的通知',
      }),
    ])
  })
})
