import type { DrizzleService } from '@db/core'
import { MessageNotificationTemplateService } from './notification-template.service'
import { MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM } from './notification.constant'

function createTemplateDrizzleStub(
  template?: {
    id: number
    titleTemplate: string
    contentTemplate: string
  },
  actor?: {
    id: number
    nickname: string
    avatarUrl?: string | null
  },
) {
  const inserted: Array<Record<string, unknown>> = []

  const drizzle = {
    db: {
      insert: jest.fn().mockReturnValue({
        values: jest
          .fn()
          .mockImplementation(async (value: Record<string, unknown>) => {
            inserted.push(value)
            return value
          }),
      }),
      query: {
        notificationTemplate: {
          findFirst: jest.fn().mockResolvedValue(template),
        },
        appUser: {
          findFirst: jest.fn().mockResolvedValue(actor),
        },
      },
    },
    schema: {
      notificationTemplate: {},
    },
    withErrorHandling: jest
      .fn()
      .mockImplementation(async (fn: () => Promise<unknown>) => fn()),
    isUniqueViolation: jest.fn().mockReturnValue(false),
  } as unknown as DrizzleService

  return {
    drizzle,
    inserted,
  }
}

describe('message notification template service', () => {
  it('accepts actor/data placeholders for destructive template migration', async () => {
    const { drizzle, inserted } = createTemplateDrizzleStub()
    const service = new MessageNotificationTemplateService(drizzle)

    await expect(
      service.createNotificationTemplate({
        categoryKey: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_LIKE,
        titleTemplate: '{{actor.nickname}} 点赞了你的主题',
        contentTemplate: '{{data.object.title}}',
      }),
    ).resolves.toBe(true)

    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({
      categoryKey: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_LIKE,
      titleTemplate: '{{actor.nickname}} 点赞了你的主题',
      contentTemplate: '{{data.object.title}}',
    })
  })

  it('renders actor/data placeholders without falling back', async () => {
    const { drizzle } = createTemplateDrizzleStub(
      {
        id: 1,
        titleTemplate: '{{actor.nickname}} 点赞了你的评论',
        contentTemplate: '{{data.object.snippet}}',
      },
      {
        id: 2,
        nickname: '张三',
        avatarUrl: null,
      },
    )
    const service = new MessageNotificationTemplateService(drizzle)

    const rendered = await service.renderNotificationTemplate({
      categoryKey: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE,
      receiverUserId: 1,
      actorUserId: 2,
      title: '兜底标题',
      content: '兜底正文',
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
    })

    expect(rendered).toEqual({
      title: '张三 点赞了你的评论',
      content: '很关键的一条评论',
      categoryKey: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE,
      actor: {
        id: 2,
        nickname: '张三',
        avatarUrl: null,
      },
      templateId: 1,
      usedTemplate: true,
    })
  })
})
