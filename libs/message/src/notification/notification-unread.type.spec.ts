import {
  buildNotificationUnreadSummary,
  createNotificationUnreadByCategory,
} from './notification-unread.type'

const EXPECTED_UNREAD_BY_CATEGORY = {
  comment_reply: 0,
  comment_mention: 0,
  comment_like: 0,
  topic_like: 0,
  topic_favorited: 0,
  topic_commented: 0,
  topic_mentioned: 0,
  user_followed: 0,
  system_announcement: 0,
  task_reminder: 0,
} as const

describe('notification unread summary helpers', () => {
  it('fills missing category keys with zero and sums total from the byCategory map', () => {
    const result = buildNotificationUnreadSummary([
      { categoryKey: 'comment_reply', count: 2 },
      { categoryKey: 'topic_like', count: 1 },
    ])

    expect(result.total).toBe(3)
    expect(result.byCategory).toEqual({
      ...EXPECTED_UNREAD_BY_CATEGORY,
      comment_reply: 2,
      topic_like: 1,
    })
  })

  it('ignores unknown category keys while keeping the contract stable', () => {
    const result = buildNotificationUnreadSummary([
      { categoryKey: 'comment_reply', count: 2 },
      { categoryKey: 'future_key', count: 99 },
    ])

    expect(result.total).toBe(2)
    expect(result.byCategory).toEqual({
      ...EXPECTED_UNREAD_BY_CATEGORY,
      comment_reply: 2,
    })
  })

  it('builds the current public unread key set as a full zeroed map', () => {
    const result = createNotificationUnreadByCategory()

    expect(result).toEqual(EXPECTED_UNREAD_BY_CATEGORY)
  })
})
