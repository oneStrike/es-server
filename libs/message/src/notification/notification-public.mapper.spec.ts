import { mapUserNotificationToPublicView } from './notification-public.mapper'

describe('mapUserNotificationToPublicView', () => {
  it('maps notification rows to the new public contract', () => {
    const mapped = mapUserNotificationToPublicView(
      {
        id: 1,
        categoryKey: 'comment_like',
        projectionKey: 'k',
        receiverUserId: 9,
        actorUserId: 2,
        title: '张三 点赞了你的评论',
        content: '很关键的一条评论',
        payload: {
          object: {
            kind: 'comment',
            id: 7,
            snippet: '很关键的一条评论',
          },
          container: {
            kind: 'topic',
            id: 8,
            title: '帖子标题',
          },
        },
        isRead: false,
        readAt: null,
        expiresAt: null,
        createdAt: new Date('2026-04-18T00:00:00.000Z'),
        updatedAt: new Date('2026-04-18T00:00:00.000Z'),
      } as never,
      {
        id: 2,
        nickname: '张三',
        avatarUrl: 'https://example.com/avatar.png',
      },
    )

    expect(mapped).toEqual({
      id: 1,
      type: 'comment_like',
      actor: {
        id: 2,
        nickname: '张三',
        avatarUrl: 'https://example.com/avatar.png',
      },
      message: {
        title: '张三 点赞了你的评论',
        body: '很关键的一条评论',
      },
      data: {
        object: {
          kind: 'comment',
          id: 7,
          snippet: '很关键的一条评论',
        },
        container: {
          kind: 'topic',
          id: 8,
          title: '帖子标题',
        },
      },
      isRead: false,
      readAt: undefined,
      expiresAt: undefined,
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    })
  })

  it('keeps actor avatarUrl as null when the source value is empty', () => {
    const mapped = mapUserNotificationToPublicView(
      {
        id: 2,
        categoryKey: 'comment_like',
        projectionKey: 'k2',
        receiverUserId: 9,
        actorUserId: 3,
        title: '李四 点赞了你的评论',
        content: '另一条评论',
        payload: null,
        isRead: false,
        readAt: null,
        expiresAt: null,
        createdAt: new Date('2026-04-18T00:00:00.000Z'),
        updatedAt: new Date('2026-04-18T00:00:00.000Z'),
      } as never,
      {
        id: 3,
        nickname: '李四',
        avatarUrl: null,
      },
    )

    expect(mapped.actor).toEqual({
      id: 3,
      nickname: '李四',
      avatarUrl: null,
    })
  })
})
