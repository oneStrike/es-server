import type { DrizzleService } from '@db/core'
import { MessageNotificationPreferenceSourceEnum } from './notification.constant'
import { MessageNotificationPreferenceService } from './notification-preference.service'

function createServiceWithFindMany(
  findManyResult: Array<{
    id: number
    categoryKey: string
    isEnabled: boolean
    updatedAt: Date
  }>,
) {
  const findMany = jest.fn().mockResolvedValue(findManyResult)
  const findFirst = jest.fn().mockResolvedValue(findManyResult[0] ?? undefined)
  const withErrorHandling = jest.fn(async (fn: () => unknown) => fn())
  const transaction = jest.fn(async (fn: (tx: any) => unknown) =>
    fn({
      delete: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
  )

  const drizzle = {
    db: {
      query: {
        notificationPreference: {
          findMany,
          findFirst,
        },
      },
      transaction,
    },
    withErrorHandling,
    schema: {
      notificationPreference: {
        userId: 'userId',
        categoryKey: 'categoryKey',
      },
    },
  } as unknown as DrizzleService

  return {
    service: new MessageNotificationPreferenceService(drizzle),
    mocks: {
      findMany,
      findFirst,
      transaction,
      withErrorHandling,
    },
  }
}

describe('notification-preference.service', () => {
  it('returns preference list items without leaking preferenceId', async () => {
    const updatedAt = new Date('2026-04-20T00:00:00.000Z')
    const { service } = createServiceWithFindMany([
      {
        id: 7,
        categoryKey: 'comment_reply',
        isEnabled: false,
        updatedAt,
      },
    ])

    const result = await service.getUserNotificationPreferenceList(1001)
    const explicitItem = result.find(
      (item) => item.categoryKey === 'comment_reply',
    )

    expect(explicitItem).toEqual({
      categoryKey: 'comment_reply',
      categoryLabel: '评论回复',
      isEnabled: false,
      defaultEnabled: true,
      source: MessageNotificationPreferenceSourceEnum.EXPLICIT,
      updatedAt,
    })
    expect(explicitItem).not.toHaveProperty('preferenceId')
  })

  it('returns updated preference list without leaking preferenceId', async () => {
    const updatedAt = new Date('2026-04-20T00:00:00.000Z')
    const { service, mocks } = createServiceWithFindMany([
      {
        id: 11,
        categoryKey: 'comment_reply',
        isEnabled: false,
        updatedAt,
      },
    ])

    const result = await service.updateUserNotificationPreferences(1001, {
      preferences: [
        {
          categoryKey: 'comment_reply',
          isEnabled: false,
        },
      ],
    })

    expect(mocks.withErrorHandling).toHaveBeenCalled()
    expect(mocks.transaction).toHaveBeenCalled()
    expect(result.find((item) => item.categoryKey === 'comment_reply')).toEqual(
      {
        categoryKey: 'comment_reply',
        categoryLabel: '评论回复',
        isEnabled: false,
        defaultEnabled: true,
        source: MessageNotificationPreferenceSourceEnum.EXPLICIT,
        updatedAt,
      },
    )
    expect(result[0]).not.toHaveProperty('preferenceId')
  })
})
