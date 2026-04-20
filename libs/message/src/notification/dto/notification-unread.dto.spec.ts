import {
  NOTIFICATION_UNREAD_SUMMARY_EXAMPLE,
  NOTIFICATION_UNREAD_BY_CATEGORY_EXAMPLE,
} from './notification-unread.dto'

describe('notification-unread.dto', () => {
  it('keeps the unread by-category example stable in dto-owned constants', () => {
    expect(NOTIFICATION_UNREAD_BY_CATEGORY_EXAMPLE).toEqual({
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
    })
  })

  it('keeps the unread summary example stable in dto-owned constants', () => {
    expect(NOTIFICATION_UNREAD_SUMMARY_EXAMPLE).toEqual({
      total: 3,
      byCategory: NOTIFICATION_UNREAD_BY_CATEGORY_EXAMPLE,
    })
  })
})
