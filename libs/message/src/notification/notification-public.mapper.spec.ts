import { mapNotificationActor, mapUserNotificationToPublicView } from './notification-public.mapper'

describe('notificationPublicMapper', () => {
  it('会移除 projectionKey 并把 payload 保持为对象', () => {
    const result = mapUserNotificationToPublicView(
      {
        id: 101,
        categoryKey: 'comment_reply',
        projectionKey: 'comment-replied:101:receiver:7',
        receiverUserId: 7,
        actorUserId: 9,
        title: '有人回复了你的评论',
        content: '回复内容',
        payload: {
          replyCommentId: 101,
        },
        isRead: false,
        readAt: null,
        expiresAt: null,
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        updatedAt: new Date('2026-04-13T00:00:00.000Z'),
      },
      {
        id: 9,
        nickname: '回复者',
        avatarUrl: 'https://example.com/avatar.png',
      },
    )

    expect(result).toEqual(
      expect.objectContaining({
        id: 101,
        categoryKey: 'comment_reply',
        categoryLabel: '评论回复',
        payload: {
          replyCommentId: 101,
        },
        actorUser: {
          id: 9,
          nickname: '回复者',
          avatarUrl: 'https://example.com/avatar.png',
        },
      }),
    )
    expect(result).not.toHaveProperty('projectionKey')
  })

  it('会把空 actor 字段收敛为 undefined，并把非对象 payload 收敛为 null', () => {
    const result = mapUserNotificationToPublicView({
      id: 102,
      categoryKey: 'task_reminder',
      projectionKey: 'task-reminder:1:user:7',
      receiverUserId: 7,
      actorUserId: null,
      title: '任务即将到期',
      content: '请尽快处理',
      payload: 'invalid-payload',
      isRead: false,
      readAt: null,
      expiresAt: null,
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
      updatedAt: new Date('2026-04-13T00:00:00.000Z'),
    })

    expect(result.payload).toBeNull()
    expect(result.actorUser).toBeUndefined()
  })

  it('会过滤 actor 的空字符串字段', () => {
    expect(
      mapNotificationActor({
        id: 9,
        nickname: '   ',
        avatarUrl: null,
      }),
    ).toEqual({
      id: 9,
    })
  })
})
