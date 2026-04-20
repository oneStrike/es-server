import type { DrizzleService } from '@db/core'
import { NotificationProjectionService } from './notification-projection.service'

function createProjectionService() {
  const insertReturning = jest.fn()
  const onConflictDoNothing = jest.fn().mockReturnValue({
    returning: insertReturning,
  })
  const values = jest.fn().mockReturnValue({
    onConflictDoNothing,
  })
  const insert = jest.fn().mockReturnValue({
    values,
  })

  const drizzle = {
    db: {
      insert,
      query: {
        userComment: {
          findFirst: jest.fn(),
        },
        forumTopic: {
          findFirst: jest.fn(),
        },
        userNotification: {
          findFirst: jest.fn(),
        },
      },
    },
    schema: {
      userNotification: {
        receiverUserId: 'receiverUserId',
        projectionKey: 'projectionKey',
      },
    },
  } as unknown as DrizzleService

  const preferenceService = {
    getEffectiveNotificationPreference: jest.fn(),
  }
  const templateService = {
    renderNotificationTemplate: jest.fn(),
  }
  const inboxService = {}

  return {
    service: new NotificationProjectionService(
      drizzle,
      preferenceService as never,
      templateService as never,
      inboxService as never,
    ),
    mocks: {
      insert,
      values,
      insertReturning,
      findUserComment: drizzle.db.query.userComment.findFirst as jest.Mock,
      findForumTopic: drizzle.db.query.forumTopic.findFirst as jest.Mock,
      renderNotificationTemplate:
        templateService.renderNotificationTemplate as jest.Mock,
    },
  }
}

describe('notification-projection.service', () => {
  it('normalizes parentComment snippet when present on comment_reply payload', async () => {
    const { service, mocks } = createProjectionService()

    mocks.findUserComment.mockResolvedValueOnce({
      content: '这是父评论正文',
    })
    mocks.findForumTopic.mockResolvedValue({
      title: '主题标题',
      sectionId: 9,
    })
    mocks.insertReturning.mockResolvedValue([{ id: 1 }])
    mocks.renderNotificationTemplate.mockImplementation(async (input) => ({
      title: input.title,
      content: input.content,
      actor: undefined,
      templateId: undefined,
      usedTemplate: false,
      fallbackReason: 'missing_or_disabled',
    }))

    await service.applyCommand(
      {
        mode: 'append',
        mandatory: true,
        categoryKey: 'comment_reply',
        projectionKey: 'pk',
        receiverUserId: 2,
        actorUserId: 3,
        title: '有人回复了你的评论',
        content: '回复内容',
        payload: {
          object: {
            kind: 'comment',
            id: 101,
            snippet: '回复内容',
          },
          parentComment: {
            kind: 'comment',
            id: 88,
          },
          container: {
            kind: 'topic',
            id: 7,
            title: '旧主题标题',
          },
        },
      } as never,
      {} as never,
      {} as never,
    )

    expect(mocks.values).toHaveBeenCalledTimes(1)
    expect(mocks.values.mock.calls[0][0].payload).toEqual({
      object: {
        kind: 'comment',
        id: 101,
        snippet: '回复内容',
      },
      parentComment: {
        kind: 'comment',
        id: 88,
        snippet: '这是父评论正文',
      },
      container: {
        kind: 'topic',
        id: 7,
        title: '主题标题',
        sectionId: 9,
      },
    })
  })

  it('keeps old comment_reply payloads readable when parentComment is absent', async () => {
    const { service, mocks } = createProjectionService()

    mocks.findForumTopic.mockResolvedValue({
      title: '主题标题',
      sectionId: 9,
    })
    mocks.insertReturning.mockResolvedValue([{ id: 1 }])
    mocks.renderNotificationTemplate.mockImplementation(async (input) => ({
      title: input.title,
      content: input.content,
      actor: undefined,
      templateId: undefined,
      usedTemplate: false,
      fallbackReason: 'missing_or_disabled',
    }))

    await service.applyCommand(
      {
        mode: 'append',
        mandatory: true,
        categoryKey: 'comment_reply',
        projectionKey: 'pk',
        receiverUserId: 2,
        actorUserId: 3,
        title: '有人回复了你的评论',
        content: '回复内容',
        payload: {
          object: {
            kind: 'comment',
            id: 101,
            snippet: '回复内容',
          },
          container: {
            kind: 'topic',
            id: 7,
            title: '旧主题标题',
          },
        },
      } as never,
      {} as never,
      {} as never,
    )

    expect(mocks.values).toHaveBeenCalledTimes(1)
    expect(mocks.values.mock.calls[0][0].payload).toEqual({
      object: {
        kind: 'comment',
        id: 101,
        snippet: '回复内容',
      },
      container: {
        kind: 'topic',
        id: 7,
        title: '主题标题',
        sectionId: 9,
      },
    })
  })

  it('drops parentComment from non-reply comment notifications', async () => {
    const { service, mocks } = createProjectionService()

    mocks.findForumTopic.mockResolvedValue({
      title: '主题标题',
      sectionId: 9,
    })
    mocks.insertReturning.mockResolvedValue([{ id: 1 }])
    mocks.renderNotificationTemplate.mockImplementation(async (input) => ({
      title: input.title,
      content: input.content,
      actor: undefined,
      templateId: undefined,
      usedTemplate: false,
      fallbackReason: 'missing_or_disabled',
    }))

    await service.applyCommand(
      {
        mode: 'append',
        mandatory: true,
        categoryKey: 'comment_like',
        projectionKey: 'pk',
        receiverUserId: 2,
        actorUserId: 3,
        title: '有人点赞了你的评论',
        content: '评论内容',
        payload: {
          object: {
            kind: 'comment',
            id: 101,
            snippet: '评论内容',
          },
          parentComment: {
            kind: 'comment',
            id: 88,
            snippet: '不应保留的父评论',
          },
          container: {
            kind: 'topic',
            id: 7,
            title: '旧主题标题',
          },
        },
      } as never,
      {} as never,
      {} as never,
    )

    expect(mocks.values).toHaveBeenCalledTimes(1)
    expect(mocks.values.mock.calls[0][0].payload).toEqual({
      object: {
        kind: 'comment',
        id: 101,
        snippet: '评论内容',
      },
      container: {
        kind: 'topic',
        id: 7,
        title: '主题标题',
        sectionId: 9,
      },
    })
  })
})
