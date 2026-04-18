import {
  normalizeMessageNotificationCategoryKeysFilter,
  serializeMessageNotificationCategoryKeysFilter,
} from './notification-category-key-filter.util'
import { MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM } from './notification.constant'

describe('message notification category key filter', () => {
  it('splits supported delimiters and deduplicates valid category keys', () => {
    expect(
      normalizeMessageNotificationCategoryKeysFilter(
        ` ${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY}，${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE};${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TASK_REMINDER}|${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE} `,
      ),
    ).toEqual([
      MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
      MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE,
      MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TASK_REMINDER,
    ])
  })

  it('returns undefined for blank or fully invalid filters', () => {
    expect(
      normalizeMessageNotificationCategoryKeysFilter(' , ; | '),
    ).toBeUndefined()
    expect(
      normalizeMessageNotificationCategoryKeysFilter('invalid_key'),
    ).toBeUndefined()
  })

  it('serializes repeated query params into a single comma-delimited string', () => {
    expect(
      serializeMessageNotificationCategoryKeysFilter([
        MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
        ` ${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE} `,
      ]),
    ).toBe(
      `${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY},${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE}`,
    )
  })
})
