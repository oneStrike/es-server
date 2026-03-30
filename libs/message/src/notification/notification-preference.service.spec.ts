import {
  MessageNotificationPreferenceSourceEnum,
  MessageNotificationTypeEnum,
} from './notification.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

describe('message notification preference service', () => {
  it('merges explicit overrides with default preference values', async () => {
    const { MessageNotificationPreferenceService }
      = await import('./notification-preference.service')

    const service = new MessageNotificationPreferenceService({
      db: {
        query: {
          notificationPreference: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 5,
                userId: 1001,
                notificationType: MessageNotificationTypeEnum.COMMENT_LIKE,
                isEnabled: false,
                updatedAt: new Date('2026-03-28T12:00:00.000Z'),
              },
            ]),
          },
        },
      },
    } as any)

    await expect(
      service.getUserNotificationPreferenceList(1001),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
          isEnabled: true,
          defaultEnabled: true,
          source: MessageNotificationPreferenceSourceEnum.DEFAULT,
        }),
        expect.objectContaining({
          notificationType: MessageNotificationTypeEnum.COMMENT_LIKE,
          isEnabled: false,
          defaultEnabled: true,
          source: MessageNotificationPreferenceSourceEnum.EXPLICIT,
          preferenceId: 5,
        }),
        expect.objectContaining({
          notificationType: MessageNotificationTypeEnum.TOPIC_LIKE,
          isEnabled: true,
          defaultEnabled: true,
          source: MessageNotificationPreferenceSourceEnum.DEFAULT,
        }),
        expect.objectContaining({
          notificationType: MessageNotificationTypeEnum.TOPIC_FAVORITE,
          isEnabled: true,
          defaultEnabled: true,
          source: MessageNotificationPreferenceSourceEnum.DEFAULT,
        }),
        expect.objectContaining({
          notificationType: MessageNotificationTypeEnum.TOPIC_COMMENT,
          isEnabled: true,
          defaultEnabled: true,
          source: MessageNotificationPreferenceSourceEnum.DEFAULT,
        }),
      ]),
    )
  })

  it('stores only explicit overrides when updating preferences', async () => {
    const { MessageNotificationPreferenceService }
      = await import('./notification-preference.service')

    const deleteWhere = jest.fn().mockResolvedValue(undefined)
    const deleteFn = jest.fn(() => ({ where: deleteWhere }))
    const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined)
    const values = jest.fn(() => ({ onConflictDoUpdate }))
    const insert = jest.fn(() => ({ values }))
    const transaction = jest.fn(async (callback) =>
      callback({
        delete: deleteFn,
        insert,
      }),
    )
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 9,
        userId: 1001,
        notificationType: MessageNotificationTypeEnum.COMMENT_LIKE,
        isEnabled: false,
        updatedAt: new Date('2026-03-28T12:30:00.000Z'),
      },
    ])
    const service = new MessageNotificationPreferenceService({
      db: {
        transaction,
        query: {
          notificationPreference: {
            findMany,
          },
        },
      },
      schema: {
        notificationPreference: {
          userId: 'userId',
          notificationType: 'notificationType',
        },
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
    } as any)

    await expect(
      service.updateUserNotificationPreferences(1001, {
        preferences: [
          {
            notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
            isEnabled: true,
          },
          {
            notificationType: MessageNotificationTypeEnum.COMMENT_LIKE,
            isEnabled: false,
          },
        ],
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          notificationType: MessageNotificationTypeEnum.COMMENT_LIKE,
          isEnabled: false,
          source: MessageNotificationPreferenceSourceEnum.EXPLICIT,
        }),
      ]),
    )

    expect(deleteWhere).toHaveBeenCalled()
    expect(values).toHaveBeenCalledWith({
      userId: 1001,
      notificationType: MessageNotificationTypeEnum.COMMENT_LIKE,
      isEnabled: false,
    })
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({
          isEnabled: false,
        }),
      }),
    )
  })
})
