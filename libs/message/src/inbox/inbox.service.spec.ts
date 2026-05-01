import type { DrizzleService } from '@db/core'
import type { MessageInboxSummaryQueryService } from './inbox-summary-query.service'
import { MessageInboxService } from './inbox.service'

type InboxSummaryQueryMock = jest.Mocked<
  Pick<
    MessageInboxSummaryQueryService,
    | 'getNotificationUnreadSummary'
    | 'getChatUnreadAggregate'
    | 'getLatestNotification'
    | 'getLatestConversation'
    | 'getLatestChatMessage'
  >
>

function createService() {
  const summaryQueryService: InboxSummaryQueryMock = {
    getNotificationUnreadSummary: jest.fn().mockResolvedValue([]),
    getChatUnreadAggregate: jest.fn().mockResolvedValue([{ unreadCount: 0 }]),
    getLatestNotification: jest.fn().mockResolvedValue([]),
    getLatestConversation: jest.fn().mockResolvedValue([]),
    getLatestChatMessage: jest.fn(),
  }

  return {
    service: new MessageInboxService(
      {} as unknown as DrizzleService,
      summaryQueryService as unknown as MessageInboxSummaryQueryService,
    ),
    mocks: {
      summaryQueryService,
    },
  }
}

describe('inbox.service prepared summary queries', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-04-20T00:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('builds notification summary from the prepared summary query service', async () => {
    const { service, mocks } = createService()
    mocks.summaryQueryService.getNotificationUnreadSummary.mockResolvedValue([
      {
        categoryKey: 'comment_reply',
        count: 2,
      },
    ])
    mocks.summaryQueryService.getChatUnreadAggregate.mockResolvedValue([
      {
        unreadCount: 3,
      },
    ])
    mocks.summaryQueryService.getLatestNotification.mockResolvedValue([
      {
        id: 9,
        categoryKey: 'comment_reply',
        title: '有人回复了你',
        content: '新的回复',
        createdAt: new Date('2026-04-19T00:00:00.000Z'),
        expiresAt: null,
      },
    ])

    const result = await service.getNotificationSummary(1001)

    expect(
      mocks.summaryQueryService.getNotificationUnreadSummary,
    ).toHaveBeenCalledWith({
      userId: 1001,
      now: new Date('2026-04-20T00:00:00.000Z'),
    })
    expect(
      mocks.summaryQueryService.getChatUnreadAggregate,
    ).toHaveBeenCalledWith({
      userId: 1001,
    })
    expect(
      mocks.summaryQueryService.getLatestNotification,
    ).toHaveBeenCalledWith({
      userId: 1001,
      now: new Date('2026-04-20T00:00:00.000Z'),
    })
    expect(result.notificationUnread.total).toBe(2)
    expect(result.chatUnreadCount).toBe(3)
    expect(result.totalUnreadCount).toBe(5)
    expect(result.latestNotification).toMatchObject({
      id: 9,
      categoryKey: 'comment_reply',
      categoryLabel: '评论回复',
      title: '有人回复了你',
    })
  })

  it('builds full inbox summary with the latest chat message query', async () => {
    const { service, mocks } = createService()
    const lastMessageAt = new Date('2026-04-19T12:00:00.000Z')
    mocks.summaryQueryService.getNotificationUnreadSummary.mockResolvedValue([
      {
        categoryKey: 'task_reminder',
        count: 1,
      },
    ])
    mocks.summaryQueryService.getChatUnreadAggregate.mockResolvedValue([
      {
        unreadCount: 4,
      },
    ])
    mocks.summaryQueryService.getLatestConversation.mockResolvedValue([
      {
        id: 200,
        lastMessageId: 300n,
        lastMessageAt,
        lastSenderId: 1002,
      },
    ])
    mocks.summaryQueryService.getLatestChatMessage.mockResolvedValue({
      content: '最近的一条私信',
    })

    const result = await service.getSummary(1001)

    expect(
      mocks.summaryQueryService.getLatestConversation,
    ).toHaveBeenCalledWith({
      userId: 1001,
    })
    expect(mocks.summaryQueryService.getLatestChatMessage).toHaveBeenCalledWith(
      {
        messageId: 300n,
      },
    )
    expect(result.totalUnreadCount).toBe(5)
    expect(result.latestChat).toEqual({
      conversationId: 200,
      lastMessageId: '300',
      lastMessageAt,
      lastMessageContent: '最近的一条私信',
      lastSenderId: 1002,
    })
  })

  it('does not query latest chat message content without a last message id', async () => {
    const { service, mocks } = createService()
    mocks.summaryQueryService.getLatestConversation.mockResolvedValue([
      {
        id: 200,
        lastMessageId: null,
        lastMessageAt: null,
        lastSenderId: null,
      },
    ])

    const result = await service.getSummary(1001)

    expect(
      mocks.summaryQueryService.getLatestChatMessage,
    ).not.toHaveBeenCalled()
    expect(result.latestChat).toEqual({
      conversationId: 200,
      lastMessageId: undefined,
      lastMessageAt: undefined,
      lastMessageContent: undefined,
      lastSenderId: undefined,
    })
  })
})
