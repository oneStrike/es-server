/// <reference types="jest" />

import { MessageInboxService } from './inbox.service'

describe('MessageInboxService unread summary', () => {
  it('builds the user-center unread summary without reading latest messages', async () => {
    const summaryQueryService = {
      getNotificationUnreadSummary: jest.fn(async () => [
        { categoryKey: 'comment_reply', count: 2 },
        { categoryKey: 'system_announcement', count: 1 },
      ]),
      getChatUnreadAggregate: jest.fn(async () => [{ unreadCount: 4 }]),
      getLatestNotification: jest.fn(),
      getLatestConversation: jest.fn(),
      getLatestChatMessage: jest.fn(),
    }
    const service = new MessageInboxService(
      {} as never,
      summaryQueryService as never,
    )

    await expect(service.getUnreadSummary(7)).resolves.toMatchObject({
      notificationUnread: {
        total: 3,
        byCategory: {
          comment_reply: 2,
          system_announcement: 1,
        },
      },
      chatUnreadCount: 4,
      totalUnreadCount: 7,
    })
    expect(
      summaryQueryService.getNotificationUnreadSummary,
    ).toHaveBeenCalledWith({
      userId: 7,
      now: expect.any(Date),
    })
    expect(summaryQueryService.getChatUnreadAggregate).toHaveBeenCalledWith({
      userId: 7,
    })
    expect(summaryQueryService.getLatestNotification).not.toHaveBeenCalled()
    expect(summaryQueryService.getLatestConversation).not.toHaveBeenCalled()
    expect(summaryQueryService.getLatestChatMessage).not.toHaveBeenCalled()
  })
})
