import { MessageController } from './message.controller'

const EXPECTED_UNREAD_SUMMARY = {
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

describe('message controller', () => {
  it('returns the breaking unread summary contract from unreadCount', async () => {
    const controller = new MessageController(
      {
        getUnreadCount: jest.fn().mockResolvedValue(EXPECTED_UNREAD_SUMMARY),
      } as never,
      {} as never,
      {} as never,
      {} as never,
    )

    const result = await controller.unreadCount(7)

    expect(result).toEqual(EXPECTED_UNREAD_SUMMARY)
    expect(result).not.toHaveProperty('count')
  })
})
