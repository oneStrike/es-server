import { MessageNotificationRealtimeService } from './notification-realtime.service'

const EXPECTED_NOTIFICATION_UNREAD = {
  total: 3,
  byCategory: {
    comment_reply: 2,
    comment_mention: 0,
    comment_like: 0,
    topic_like: 1,
    topic_favorited: 0,
    topic_commented: 0,
    topic_mentioned: 0,
    user_followed: 0,
    system_announcement: 0,
    task_reminder: 0,
  },
} as const

describe('message notification realtime service', () => {
  it('emits inbox summary updates with notificationUnread instead of the legacy flat count', () => {
    const messageWebSocketService = {
      emitToUser: jest.fn(),
    }
    const service = new MessageNotificationRealtimeService(
      messageWebSocketService as never,
    )

    service.emitInboxSummaryUpdated(7, {
      notificationUnread: EXPECTED_NOTIFICATION_UNREAD,
      chatUnreadCount: 5,
      totalUnreadCount: 8,
      latestNotification: undefined,
      latestChat: undefined,
    })

    expect(messageWebSocketService.emitToUser).toHaveBeenCalledWith(
      7,
      'inbox.summary.updated',
      expect.objectContaining({
        notificationUnread: EXPECTED_NOTIFICATION_UNREAD,
        chatUnreadCount: 5,
        totalUnreadCount: 8,
      }),
    )
    expect(
      (messageWebSocketService.emitToUser as jest.Mock).mock.calls[0][2],
    ).not.toHaveProperty('notificationUnreadCount')
  })
})
