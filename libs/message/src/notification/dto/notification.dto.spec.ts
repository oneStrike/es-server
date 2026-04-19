import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM } from '../notification.constant'
import {
  QueryUserNotificationListDto,
  UserNotificationDto,
} from './notification.dto'
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

  it('documents notification data with explicit oneOf schemas', () => {
    const metadata = Reflect.getMetadata(
      'swagger/apiModelProperties',
      UserNotificationDto.prototype,
      'data',
    ) as
      | {
          nullable?: boolean
          oneOf?: Array<{ $ref: string }>
        }
      | undefined

    expect(metadata?.nullable).toBe(true)
    expect(metadata?.oneOf).toEqual([
      { $ref: '#/components/schemas/NotificationCommentActionDataDto' },
      { $ref: '#/components/schemas/NotificationTopicObjectDataDto' },
      { $ref: '#/components/schemas/NotificationTopicCommentedDataDto' },
      { $ref: '#/components/schemas/NotificationAnnouncementDataDto' },
      { $ref: '#/components/schemas/NotificationTaskReminderDataDto' },
    ])
  })

  it('documents unread byCategory as a number-valued map', () => {
    const previousNodeEnv = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = 'development'
      jest.resetModules()
      const { BaseNotificationUnreadDto, NotificationUnreadByCategoryDto } =
        require('./notification-unread.dto') as typeof import('./notification-unread.dto')

      const metadata = Reflect.getMetadata(
        'swagger/apiModelProperties',
        BaseNotificationUnreadDto.prototype,
        'byCategory',
      ) as
        | {
            type?: unknown
          }
        | undefined

      expect(metadata?.type).toBe(NotificationUnreadByCategoryDto)

      const commentReplyMetadata = Reflect.getMetadata(
        'swagger/apiModelProperties',
        NotificationUnreadByCategoryDto.prototype,
        'comment_reply',
      ) as { description?: string; example?: number } | undefined
      const taskReminderMetadata = Reflect.getMetadata(
        'swagger/apiModelProperties',
        NotificationUnreadByCategoryDto.prototype,
        'task_reminder',
      ) as { description?: string; example?: number } | undefined

      expect(commentReplyMetadata).toMatchObject({
        description: '评论回复未读数',
        example: 2,
      })
      expect(taskReminderMetadata).toMatchObject({
        description: '任务提醒未读数',
        example: 0,
      })
    } finally {
      process.env.NODE_ENV = previousNodeEnv
    }
  })
})
