import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import {
  MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
} from '../notification.constant'
import { QueryUserNotificationListDto } from './notification.dto'
import 'reflect-metadata'

describe('query user notification list dto', () => {
  it('accepts delimited category key string filters', () => {
    const dto = plainToInstance(QueryUserNotificationListDto, {
      categoryKeys: ` ${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY}，${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE};${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TASK_REMINDER}|${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE} `,
    })

    expect(dto.categoryKeys).toBe(
      `${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY},${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE},${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TASK_REMINDER},${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE}`,
    )
    expect(validateSync(dto)).toHaveLength(0)
  })

  it('normalizes repeated category key query values into the string contract', () => {
    const dto = plainToInstance(QueryUserNotificationListDto, {
      categoryKeys: [
        MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
        ` ${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE} `,
      ],
    })

    expect(dto.categoryKeys).toBe(
      `${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY},${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE}`,
    )
    expect(validateSync(dto)).toHaveLength(0)
  })

  it('rejects invalid category keys inside delimited strings', () => {
    const dto = plainToInstance(QueryUserNotificationListDto, {
      categoryKeys: `${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY},invalid_key`,
    })

    expect(validateSync(dto)).toHaveLength(1)
  })
})
