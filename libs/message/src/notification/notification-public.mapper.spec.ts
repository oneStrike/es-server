import type { UserNotificationSelect } from '@db/schema'
import {
  mapNotificationActor,
  mapUserNotificationToPublicView,
} from './notification-public.mapper'

function createNotification(
  overrides: Partial<UserNotificationSelect> = {},
): UserNotificationSelect {
  const now = new Date('2026-04-20T00:00:00.000Z')

  return {
    id: 1,
    categoryKey: 'comment_reply',
    projectionKey: 'comment:1:user:2',
    receiverUserId: 2,
    actorUserId: 3,
    title: '有人回复了你的评论',
    content: '回复内容',
    payload: {
      object: {
        kind: 'comment',
        id: 101,
        snippet: '这条评论很关键',
      },
    },
    announcementId: null,
    isRead: false,
    readAt: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('notification-public.mapper', () => {
  it('maps actor and payload into the public notification dto', () => {
    const notification = createNotification()

    const result = mapUserNotificationToPublicView(notification, {
      id: 3,
      nickname: '测试用户',
      avatarUrl: '   ',
    })

    expect(result.actor).toEqual({
      id: 3,
      nickname: '测试用户',
      avatarUrl: null,
    })
    expect(result.message).toEqual({
      title: notification.title,
      body: notification.content,
    })
    expect(result.data).toEqual(notification.payload)
  })

  it('drops actor and non-object payload values', () => {
    const notification = createNotification({
      payload: 'invalid-payload' as UserNotificationSelect['payload'],
    })

    const result = mapUserNotificationToPublicView(notification)

    expect(result.actor).toBeUndefined()
    expect(result.data).toBeNull()
  })

  it('rejects unsupported notification category keys', () => {
    const notification = createNotification({
      categoryKey: 'unknown_category',
    })

    expect(() => mapUserNotificationToPublicView(notification)).toThrow(
      'Unsupported notification category key: unknown_category',
    )
  })

  it('normalizes blank avatar urls while preserving nickname', () => {
    expect(
      mapNotificationActor({
        id: 7,
        nickname: '昵称',
        avatarUrl: ' ',
      }),
    ).toEqual({
      id: 7,
      nickname: '昵称',
      avatarUrl: null,
    })
  })
})
